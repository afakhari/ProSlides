package platformhttp

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var durationBuckets = [...]float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

type metricKey struct{ method, route, status string }
type routeMetric struct {
	count   atomic.Uint64
	nanos   atomic.Uint64
	buckets [len(durationBuckets) + 1]atomic.Uint64
}

// Metrics exposes a dependency-free Prometheus text endpoint. Labels are
// restricted to mux patterns, known methods, and status classes, preventing
// participant/session IDs from creating unbounded cardinality.
type Metrics struct {
	mux      *http.ServeMux
	inFlight atomic.Int64
	mu       sync.RWMutex
	routes   map[metricKey]*routeMetric
	sources  []MetricSource
}

func newMetrics(mux *http.ServeMux, sources []MetricSource) *Metrics {
	return &Metrics{mux: mux, routes: make(map[metricKey]*routeMetric), sources: append([]MetricSource(nil), sources...)}
}

func (m *Metrics) handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, pattern := m.mux.Handler(r)
		if pattern == "" {
			pattern = "unmatched"
		}
		method := boundedMethod(r.Method)
		m.inFlight.Add(1)
		started := time.Now()
		writer := &metricsWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(writer, r)
		m.inFlight.Add(-1)
		m.observe(metricKey{method: method, route: pattern, status: strconv.Itoa(writer.status/100) + "xx"}, time.Since(started))
	})
}

func (m *Metrics) observe(key metricKey, duration time.Duration) {
	m.mu.RLock()
	metric := m.routes[key]
	m.mu.RUnlock()
	if metric == nil {
		m.mu.Lock()
		metric = m.routes[key]
		if metric == nil {
			metric = &routeMetric{}
			m.routes[key] = metric
		}
		m.mu.Unlock()
	}
	metric.count.Add(1)
	metric.nanos.Add(uint64(duration))
	seconds := duration.Seconds()
	for index, upper := range durationBuckets {
		if seconds <= upper {
			metric.buckets[index].Add(1)
		}
	}
	metric.buckets[len(durationBuckets)].Add(1)
}

func (m *Metrics) serve(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	fmt.Fprintln(w, "# HELP proslides_http_requests_total Completed HTTP requests.")
	fmt.Fprintln(w, "# TYPE proslides_http_requests_total counter")
	fmt.Fprintln(w, "# HELP proslides_http_request_duration_seconds HTTP request duration.")
	fmt.Fprintln(w, "# TYPE proslides_http_request_duration_seconds histogram")
	m.mu.RLock()
	keys := make([]metricKey, 0, len(m.routes))
	for key := range m.routes {
		keys = append(keys, key)
	}
	m.mu.RUnlock()
	sort.Slice(keys, func(i, j int) bool {
		return keys[i].method+keys[i].route+keys[i].status < keys[j].method+keys[j].route+keys[j].status
	})
	for _, key := range keys {
		m.mu.RLock()
		metric := m.routes[key]
		m.mu.RUnlock()
		labels := fmt.Sprintf(`method=%q,route=%q,status=%q`, key.method, key.route, key.status)
		fmt.Fprintf(w, "proslides_http_requests_total{%s} %d\n", labels, metric.count.Load())
		for index, upper := range durationBuckets {
			fmt.Fprintf(w, "proslides_http_request_duration_seconds_bucket{%s,le=%q} %d\n", labels, strconv.FormatFloat(upper, 'g', -1, 64), metric.buckets[index].Load())
		}
		fmt.Fprintf(w, "proslides_http_request_duration_seconds_bucket{%s,le=\"+Inf\"} %d\n", labels, metric.buckets[len(durationBuckets)].Load())
		fmt.Fprintf(w, "proslides_http_request_duration_seconds_sum{%s} %.9f\n", labels, float64(metric.nanos.Load())/float64(time.Second))
		fmt.Fprintf(w, "proslides_http_request_duration_seconds_count{%s} %d\n", labels, metric.count.Load())
	}
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	fmt.Fprintf(w, "# TYPE proslides_http_in_flight_requests gauge\nproslides_http_in_flight_requests %d\n", m.inFlight.Load())
	fmt.Fprintf(w, "# TYPE proslides_process_goroutines gauge\nproslides_process_goroutines %d\n", runtime.NumGoroutine())
	fmt.Fprintf(w, "# TYPE proslides_process_heap_bytes gauge\nproslides_process_heap_bytes %d\n", memory.HeapAlloc)
	for _, source := range m.sources {
		source.WritePrometheus(io.Writer(w))
	}
}

type metricsWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *metricsWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *metricsWriter) Write(body []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}
func (w *metricsWriter) Flush() {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}
func (w *metricsWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("hijacking unsupported")
	}
	return hijacker.Hijack()
}
func (w *metricsWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func boundedMethod(method string) string {
	switch strings.ToUpper(method) {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodHead:
		return strings.ToUpper(method)
	default:
		return "OTHER"
	}
}
