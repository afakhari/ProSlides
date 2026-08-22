package migrate

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/*.sql
var files embed.FS

// migrationLockKey is stable across every ProSlides API replica sharing a
// database. A session-scoped advisory lock serializes startup migrations while
// still allowing replicas to start concurrently and wait for the migrator.
const migrationLockKey int64 = 0x50726f536c696465

func Apply(ctx context.Context, p *pgxpool.Pool) error {
	conn, err := p.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer conn.Release()

	if _, err = conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLockKey); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlockCtx, `SELECT pg_advisory_unlock($1)`, migrationLockKey)
	}()

	if _, err = conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}
	d, err := files.ReadDir("sql")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}
	var n []string
	for _, x := range d {
		if strings.HasSuffix(x.Name(), ".sql") {
			n = append(n, x.Name())
		}
	}
	sort.Strings(n)
	for _, v := range n {
		tx, beginErr := conn.Begin(ctx)
		if beginErr != nil {
			return fmt.Errorf("begin migration %s: %w", v, beginErr)
		}
		var ok bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, v).Scan(&ok); err != nil {
			rollback(tx)
			return fmt.Errorf("check migration %s: %w", v, err)
		}
		if ok {
			if err = tx.Commit(ctx); err != nil {
				return fmt.Errorf("finish migration check %s: %w", v, err)
			}
			continue
		}
		b, readErr := files.ReadFile("sql/" + v)
		if readErr != nil {
			rollback(tx)
			return fmt.Errorf("read migration %s: %w", v, readErr)
		}
		if _, err = tx.Exec(ctx, string(b)); err != nil {
			rollback(tx)
			return fmt.Errorf("apply migration %s: %w", v, err)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version)VALUES($1)`, v); err != nil {
			rollback(tx)
			return fmt.Errorf("record migration %s: %w", v, err)
		}
		if err = tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", v, err)
		}
	}
	return nil
}

func rollback(tx pgx.Tx) {
	rollbackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(rollbackCtx)
}
