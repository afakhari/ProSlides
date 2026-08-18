package migrate

import (
	"context"
	"embed"
	"github.com/jackc/pgx/v5/pgxpool"
	"sort"
	"strings"
)

//go:embed sql/*.sql
var files embed.FS

func Apply(ctx context.Context, p *pgxpool.Pool) error {
	if _, e := p.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); e != nil {
		return e
	}
	d, e := files.ReadDir("sql")
	if e != nil {
		return e
	}
	var n []string
	for _, x := range d {
		if strings.HasSuffix(x.Name(), ".sql") {
			n = append(n, x.Name())
		}
	}
	sort.Strings(n)
	for _, v := range n {
		var ok bool
		if e = p.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, v).Scan(&ok); e != nil {
			return e
		}
		if ok {
			continue
		}
		b, e := files.ReadFile("sql/" + v)
		if e != nil {
			return e
		}
		if _, e = p.Exec(ctx, string(b)); e != nil {
			return e
		}
		if _, e = p.Exec(ctx, `INSERT INTO schema_migrations(version)VALUES($1)`, v); e != nil {
			return e
		}
	}
	return nil
}
