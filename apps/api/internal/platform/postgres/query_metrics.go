package postgres

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
)

var queryDurationBuckets = [...]float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
var queryOperationNames = [...]string{"select", "insert", "update", "delete", "transaction", "ddl", "other"}
var queryOutcomeNames = [...]string{"success", "error", "canceled"}

type querySeries struct {
	count   atomic.Uint64
	nanos   atomic.Uint64
	buckets [len(queryDurationBuckets) + 1]atomic.Uint64
}

// queryMetrics implements pgx.QueryTracer without retaining SQL, arguments,
// table names, or request identifiers. Its fixed operation/outcome matrix keeps
// Prometheus cardinality bounded while separating pool wait from SQL execution.
type queryMetrics struct {
	series [len(queryOperationNames)][len(queryOutcomeNames)]querySeries
}

type queryTraceKey struct{}
type queryTrace struct {
	started   time.Time
	operation int
}

func (m *queryMetrics) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, queryTraceKey{}, queryTrace{started: time.Now(), operation: classifyQuery(data.SQL)})
}

func (m *queryMetrics) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	trace, ok := ctx.Value(queryTraceKey{}).(queryTrace)
	if !ok {
		return
	}
	outcome := 0
	if data.Err != nil {
		outcome = 1
		if errors.Is(data.Err, context.Canceled) || errors.Is(data.Err, context.DeadlineExceeded) {
			outcome = 2
		}
	}
	series := &m.series[trace.operation][outcome]
	duration := time.Since(trace.started)
	series.count.Add(1)
	series.nanos.Add(uint64(duration))
	for index, upper := range queryDurationBuckets {
		if duration.Seconds() <= upper {
			series.buckets[index].Add(1)
		}
	}
	series.buckets[len(queryDurationBuckets)].Add(1)
}

func classifyQuery(sql string) int {
	fields := strings.Fields(sql)
	if len(fields) == 0 {
		return len(queryOperationNames) - 1
	}
	switch strings.ToUpper(fields[0]) {
	case "SELECT":
		return 0
	case "INSERT":
		return 1
	case "UPDATE":
		return 2
	case "DELETE":
		return 3
	case "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE":
		return 4
	case "CREATE", "ALTER", "DROP", "TRUNCATE", "GRANT", "REVOKE":
		return 5
	default:
		return 6
	}
}

func (m *queryMetrics) WritePrometheus(w io.Writer) {
	fmt.Fprintln(w, "# HELP proslides_postgres_queries_total PostgreSQL calls after pool acquisition.")
	fmt.Fprintln(w, "# TYPE proslides_postgres_queries_total counter")
	fmt.Fprintln(w, "# HELP proslides_postgres_query_duration_seconds PostgreSQL call duration after pool acquisition.")
	fmt.Fprintln(w, "# TYPE proslides_postgres_query_duration_seconds histogram")
	for operation, operationName := range queryOperationNames {
		for outcome, outcomeName := range queryOutcomeNames {
			series := &m.series[operation][outcome]
			labels := fmt.Sprintf(`operation=%q,outcome=%q`, operationName, outcomeName)
			fmt.Fprintf(w, "proslides_postgres_queries_total{%s} %d\n", labels, series.count.Load())
			for index, upper := range queryDurationBuckets {
				fmt.Fprintf(w, "proslides_postgres_query_duration_seconds_bucket{%s,le=%q} %d\n", labels, strconv.FormatFloat(upper, 'g', -1, 64), series.buckets[index].Load())
			}
			fmt.Fprintf(w, "proslides_postgres_query_duration_seconds_bucket{%s,le=\"+Inf\"} %d\n", labels, series.buckets[len(queryDurationBuckets)].Load())
			fmt.Fprintf(w, "proslides_postgres_query_duration_seconds_sum{%s} %.9f\n", labels, float64(series.nanos.Load())/float64(time.Second))
			fmt.Fprintf(w, "proslides_postgres_query_duration_seconds_count{%s} %d\n", labels, series.count.Load())
		}
	}
}
