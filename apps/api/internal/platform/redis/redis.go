package redis

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

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

var fixedWindowScript = redisclient.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`)

// Allow implements an atomic fixed-window limit. The caller identity is hashed
// so raw IP addresses or email addresses are never retained in Redis keys.
func (c *Client) Allow(ctx context.Context, scope, identity string, limit int, window time.Duration) (bool, time.Duration, error) {
	digest := sha256.Sum256([]byte(identity))
	key := fmt.Sprintf("proslides:rate:%s:%x", scope, digest[:16])
	result, err := fixedWindowScript.Run(ctx, c.client, []string{key}, window.Milliseconds()).Int64Slice()
	if err != nil {
		return false, 0, err
	}
	retry := time.Duration(result[1]) * time.Millisecond
	if retry < 0 {
		retry = window
	}
	return result[0] <= int64(limit), retry, nil
}
