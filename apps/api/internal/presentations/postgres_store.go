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

func (s *PostgresStore) ListOwned(c context.Context, owner string) ([]PresentationSummary, error) {
	rows, err := s.pool.Query(c, `SELECT p.id::text,p.title,p.settings::text,
		(SELECT count(*) FROM slides sl WHERE sl.presentation_id=p.id),
		(SELECT count(*) FROM participants pa JOIN live_sessions ls ON ls.id=pa.session_id WHERE ls.presentation_id=p.id),
		p.created_at,p.updated_at FROM presentations p WHERE p.owner_id=$1
		ORDER BY p.updated_at DESC,p.id DESC LIMIT 200`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PresentationSummary, 0)
	for rows.Next() {
		var item PresentationSummary
		if err = rows.Scan(&item.ID, &item.Title, &item.Settings, &item.SlideCount, &item.ParticipantCount, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *PostgresStore) Create(c context.Context, owner, title string, settings json.RawMessage) (Presentation, error) {
	if len(settings) == 0 {
		settings = json.RawMessage(`{}`)
	}
	var p Presentation
	err := s.pool.QueryRow(c, `INSERT INTO presentations(owner_id,title,settings) VALUES($1,$2,$3) RETURNING id::text,title,settings::text,created_at,updated_at`, owner, title, settings).
		Scan(&p.ID, &p.Title, &p.Settings, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return Presentation{}, err
	}
	p.Slides = []Slide{}
	return p, nil
}

func (s *PostgresStore) Update(c context.Context, id, owner string, patch PresentationPatch) (Presentation, error) {
	var ignored string
	err := s.pool.QueryRow(c, `UPDATE presentations SET title=COALESCE($3,title),settings=COALESCE($4,settings),updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING id::text`, id, owner, patch.Title, nullableJSON(patch.Settings)).Scan(&ignored)
	if errors.Is(err, pgx.ErrNoRows) {
		return Presentation{}, ErrNotFound
	}
	if err != nil {
		return Presentation{}, err
	}
	return s.FindOwned(c, id, owner)
}

func nullableJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

func (s *PostgresStore) Delete(c context.Context, id, owner string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var exists bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, id, owner).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `DELETE FROM live_sessions WHERE presentation_id=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `DELETE FROM presentations WHERE id=$1 AND owner_id=$2`, id, owner); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) Duplicate(c context.Context, id, owner, title string) (Presentation, error) {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return Presentation{}, err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var newID string
	err = tx.QueryRow(c, `INSERT INTO presentations(owner_id,title,settings) SELECT owner_id,$3,settings FROM presentations WHERE id=$1 AND owner_id=$2 RETURNING id::text`, id, owner, title).Scan(&newID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Presentation{}, ErrNotFound
	}
	if err != nil {
		return Presentation{}, err
	}
	if _, err = tx.Exec(c, `INSERT INTO slides(presentation_id,position,kind,content) SELECT $2,position,kind,content FROM slides WHERE presentation_id=$1 ORDER BY position`, id, newID); err != nil {
		return Presentation{}, err
	}
	if err = tx.Commit(c); err != nil {
		return Presentation{}, err
	}
	return s.FindOwned(c, newID, owner)
}

func (s *PostgresStore) LatestSession(c context.Context, id, owner string) (SessionLocator, error) {
	var locator SessionLocator
	err := s.pool.QueryRow(c, `SELECT ls.id::text,ls.presentation_id::text FROM live_sessions ls JOIN presentations p ON p.id=ls.presentation_id WHERE p.id=$1 AND p.owner_id=$2 ORDER BY ls.created_at DESC,ls.id DESC LIMIT 1`, id, owner).Scan(&locator.SessionID, &locator.PresentationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionLocator{}, ErrNotFound
	}
	return locator, err
}

func (s *PostgresStore) DeleteResults(c context.Context, id, owner string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var exists bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, id, owner).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `DELETE FROM live_sessions WHERE presentation_id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) CreateSlide(c context.Context, presentationID, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	var slide Slide
	err := s.pool.QueryRow(c, `INSERT INTO slides(presentation_id,position,kind,content) SELECT id,$3,$4,$5 FROM presentations WHERE id=$1 AND owner_id=$2 RETURNING id::text,position,kind,content::text`, presentationID, owner, position, kind, content).
		Scan(&slide.ID, &slide.Position, &slide.Kind, &slide.Content)
	if errors.Is(err, pgx.ErrNoRows) {
		return Slide{}, ErrNotFound
	}
	if err == nil {
		_, _ = s.pool.Exec(c, `UPDATE presentations SET updated_at=now() WHERE id=$1`, presentationID)
	}
	return slide, err
}

func (s *PostgresStore) ReplaceSlide(c context.Context, presentationID, slideID, owner string, position int, kind string, content json.RawMessage) (Slide, error) {
	var slide Slide
	err := s.pool.QueryRow(c, `UPDATE slides sl SET position=$4,kind=$5,content=$6,updated_at=now() FROM presentations p WHERE sl.id=$2 AND sl.presentation_id=$1 AND p.id=sl.presentation_id AND p.owner_id=$3 RETURNING sl.id::text,sl.position,sl.kind,sl.content::text`, presentationID, slideID, owner, position, kind, content).
		Scan(&slide.ID, &slide.Position, &slide.Kind, &slide.Content)
	if errors.Is(err, pgx.ErrNoRows) {
		return Slide{}, ErrNotFound
	}
	if err == nil {
		_, _ = s.pool.Exec(c, `UPDATE presentations SET updated_at=now() WHERE id=$1`, presentationID)
	}
	return slide, err
}

func (s *PostgresStore) DeleteSlide(c context.Context, presentationID, slideID, owner string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var position int
	err = tx.QueryRow(c, `SELECT sl.position FROM slides sl JOIN presentations p ON p.id=sl.presentation_id WHERE sl.id=$2 AND sl.presentation_id=$1 AND p.owner_id=$3 FOR UPDATE OF sl`, presentationID, slideID, owner).Scan(&position)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(c, `DELETE FROM slides WHERE id=$1`, slideID); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1 AND position>$2`, presentationID, position); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position-1000001 WHERE presentation_id=$1 AND position>1000000`, presentationID); err != nil {
		return err
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) ReorderSlides(c context.Context, presentationID, owner string, ids []string) error {
	tx, err := s.pool.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(c) //nolint:errcheck
	var owned bool
	if err = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM presentations WHERE id=$1 AND owner_id=$2)`, presentationID, owner).Scan(&owned); err != nil {
		return err
	}
	if !owned {
		return ErrNotFound
	}
	var count int
	if err = tx.QueryRow(c, `SELECT count(*) FROM slides WHERE presentation_id=$1`, presentationID).Scan(&count); err != nil {
		return err
	}
	if count != len(ids) {
		return ErrNotFound
	}
	if _, err = tx.Exec(c, `UPDATE slides SET position=position+1000000 WHERE presentation_id=$1`, presentationID); err != nil {
		return err
	}
	for position, id := range ids {
		tag, updateErr := tx.Exec(c, `UPDATE slides SET position=$4,updated_at=now() FROM presentations p WHERE slides.id=$2 AND slides.presentation_id=$1 AND p.id=slides.presentation_id AND p.owner_id=$3`, presentationID, id, owner, position)
		if updateErr != nil {
			return updateErr
		}
		if tag.RowsAffected() != 1 {
			return ErrNotFound
		}
	}
	if _, err = tx.Exec(c, `UPDATE presentations SET updated_at=now() WHERE id=$1`, presentationID); err != nil {
		return err
	}
	return tx.Commit(c)
}

func (s *PostgresStore) FindOwned(c context.Context, id, owner string) (Presentation, error) {
	var p Presentation
	if err := s.pool.QueryRow(c, `SELECT id::text,title,settings::text,created_at,updated_at FROM presentations WHERE id=$1 AND owner_id=$2`, id, owner).Scan(&p.ID, &p.Title, &p.Settings, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Presentation{}, ErrNotFound
		}
		return Presentation{}, fmt.Errorf("find presentation: %w", err)
	}
	rows, err := s.pool.Query(c, `SELECT id::text,position,kind,content::text FROM slides WHERE presentation_id=$1 ORDER BY position`, id)
	if err != nil {
		return Presentation{}, err
	}
	defer rows.Close()
	p.Slides = make([]Slide, 0)
	for rows.Next() {
		var slide Slide
		if err = rows.Scan(&slide.ID, &slide.Position, &slide.Kind, &slide.Content); err != nil {
			return Presentation{}, err
		}
		p.Slides = append(p.Slides, slide)
	}
	return p, rows.Err()
}
