package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct{ pool *pgxpool.Pool }

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }
func (s *PostgresStore) Create(c context.Context, owner, title string) (Presentation, error) {
	var p Presentation
	if e := s.pool.QueryRow(c, `INSERT INTO presentations(owner_id,title) VALUES($1,$2) RETURNING id::text,title`, owner, title).Scan(&p.ID, &p.Title); e != nil {
		return Presentation{}, e
	}
	p.Slides = []Slide{}
	return p, nil
}
func (s *PostgresStore) CreateSlide(c context.Context, presentationID, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	var slide Slide
	e := s.pool.QueryRow(c, `INSERT INTO slides(presentation_id,position,kind,content) SELECT id,$3,$4,$5 FROM presentations WHERE id=$1 AND owner_id=$2 RETURNING id::text,position,kind,content::text`, presentationID, owner, position, kind, content).Scan(&slide.ID, &slide.Position, &slide.Kind, &slide.Content)
	if errors.Is(e, pgx.ErrNoRows) {
		return Slide{}, ErrNotFound
	}
	if e != nil {
		return Slide{}, e
	}
	return slide, nil
}
func (s *PostgresStore) FindOwned(c context.Context, id, owner string) (Presentation, error) {
	var p Presentation
	if e := s.pool.QueryRow(c, `SELECT id::text,title FROM presentations WHERE id=$1 AND owner_id=$2`, id, owner).Scan(&p.ID, &p.Title); e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			return Presentation{}, ErrNotFound
		}
		return Presentation{}, fmt.Errorf("find presentation: %w", e)
	}
	rows, e := s.pool.Query(c, `SELECT id::text,position,kind,content::text FROM slides WHERE presentation_id=$1 ORDER BY position`, id)
	if e != nil {
		return Presentation{}, e
	}
	defer rows.Close()
	for rows.Next() {
		var x Slide
		var body string
		if e = rows.Scan(&x.ID, &x.Position, &x.Kind, &body); e != nil {
			return Presentation{}, e
		}
		x.Content = []byte(body)
		p.Slides = append(p.Slides, x)
	}
	if e = rows.Err(); e != nil {
		return Presentation{}, e
	}
	if p.Slides == nil {
		p.Slides = []Slide{}
	}
	return p, nil
}
