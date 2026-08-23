package postgres

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client owns the PostgreSQL connection pool used by platform and domain
// adapters. Call Close during graceful process shutdown.
type Client struct {
	pool    *pgxpool.Pool
	queries *queryMetrics
}

type Options struct {
	MaxConns    int32
	MinConns    int32
	MaxLifetime time.Duration
	MaxIdleTime time.Duration
}

func New(ctx context.Context, databaseURL string, options Options) (*Client, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse postgres pool config: %w", err)
	}
	config.MaxConns = options.MaxConns
	config.MinConns = options.MinConns
	config.MaxConnLifetime = options.MaxLifetime
	config.MaxConnIdleTime = options.MaxIdleTime
	queries := &queryMetrics{}
	config.ConnConfig.Tracer = queries
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}
	if err = warmMinConnections(ctx, pool, options.MinConns); err != nil {
		pool.Close()
		return nil, fmt.Errorf("warm postgres minimum connections: %w", err)
	}
	return &Client{pool: pool, queries: queries}, nil
}

func warmMinConnections(ctx context.Context, pool *pgxpool.Pool, count int32) error {
	if count <= 0 {
		return pool.Ping(ctx)
	}
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		if pool.Stat().TotalConns() >= count {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (c *Client) Name() string { return "postgres" }

func (c *Client) Ping(ctx context.Context) error { return c.pool.Ping(ctx) }

func (c *Client) Pool() *pgxpool.Pool { return c.pool }

func (c *Client) Close() { c.pool.Close() }

func (c *Client) WritePrometheus(w io.Writer) {
	stats := c.pool.Stat()
	fmt.Fprintln(w, "# TYPE proslides_postgres_pool_connections gauge")
	fmt.Fprintf(w, "proslides_postgres_pool_connections{state=\"acquired\"} %d\n", stats.AcquiredConns())
	fmt.Fprintf(w, "proslides_postgres_pool_connections{state=\"idle\"} %d\n", stats.IdleConns())
	fmt.Fprintf(w, "proslides_postgres_pool_connections{state=\"total\"} %d\n", stats.TotalConns())
	fmt.Fprintf(w, "proslides_postgres_pool_connections{state=\"max\"} %d\n", stats.MaxConns())
	fmt.Fprintln(w, "# TYPE proslides_postgres_pool_acquire_total counter")
	fmt.Fprintf(w, "proslides_postgres_pool_acquire_total %d\n", stats.AcquireCount())
	fmt.Fprintln(w, "# TYPE proslides_postgres_pool_acquire_duration_seconds counter")
	fmt.Fprintf(w, "proslides_postgres_pool_acquire_duration_seconds %.9f\n", stats.AcquireDuration().Seconds())
	fmt.Fprintln(w, "# TYPE proslides_postgres_pool_empty_acquire_total counter")
	fmt.Fprintf(w, "proslides_postgres_pool_empty_acquire_total %d\n", stats.EmptyAcquireCount())
	fmt.Fprintln(w, "# TYPE proslides_postgres_pool_canceled_acquire_total counter")
	fmt.Fprintf(w, "proslides_postgres_pool_canceled_acquire_total %d\n", stats.CanceledAcquireCount())
	c.queries.WritePrometheus(w)
}
