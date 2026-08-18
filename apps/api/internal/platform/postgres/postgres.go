package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client owns the PostgreSQL connection pool used by platform and domain
// adapters. Call Close during graceful process shutdown.
type Client struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Client, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}
	return &Client{pool: pool}, nil
}

func (c *Client) Name() string { return "postgres" }

func (c *Client) Ping(ctx context.Context) error { return c.pool.Ping(ctx) }

func (c *Client) Close() { c.pool.Close() }
