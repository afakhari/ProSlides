package postgres

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestClassifyQueryUsesFixedOperations(t *testing.T) {
	tests := map[string]int{
		" SELECT 1":            0,
		"insert into answers":  1,
		"UPDATE participants":  2,
		"delete from sessions": 3,
		"rollback":             4,
		"ALTER TABLE answers":  5,
		"WITH current AS (SELECT 1) SELECT * FROM current": 6,
		"": 6,
	}
	for sql, expected := range tests {
		if actual := classifyQuery(sql); actual != expected {
			t.Fatalf("classifyQuery(%q)=%d, want %d", sql, actual, expected)
		}
	}
}

func TestQueryMetricsRecordsOutcomeWithoutSQLLabels(t *testing.T) {
	metrics := &queryMetrics{}
	ctx := metrics.TraceQueryStart(context.Background(), nil, pgx.TraceQueryStartData{SQL: "SELECT secret FROM users WHERE id=$1"})
	metrics.TraceQueryEnd(ctx, nil, pgx.TraceQueryEndData{})

	var output strings.Builder
	metrics.WritePrometheus(&output)
	text := output.String()
	if !strings.Contains(text, `proslides_postgres_queries_total{operation="select",outcome="success"} 1`) {
		t.Fatalf("successful select metric missing: %s", text)
	}
	if strings.Contains(text, "secret") || strings.Contains(text, "users") {
		t.Fatal("raw SQL leaked into bounded metric labels")
	}
}
