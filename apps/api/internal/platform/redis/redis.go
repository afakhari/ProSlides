package redis

import (
	"context"
	"fmt"

	redisclient "github.com/redis/go-redis/v9"
)

// Client owns the Redis client used for ephemeral platform concerns. Call
// Close during graceful process shutdown.
type Client struct {
	client *redisclient.Client
}

func New(redisURL string) (*Client, error) {
	options, err := redisclient.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}
	return &Client{client: redisclient.NewClient(options)}, nil
}

func (c *Client) Name() string { return "redis" }

func (c *Client) Ping(ctx context.Context) error { return c.client.Ping(ctx).Err() }

func (c *Client) Close() error { return c.client.Close() }
