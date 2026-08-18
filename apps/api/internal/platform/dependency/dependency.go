package dependency

import "context"

// Dependency is a required runtime service. Its error must be treated as
// internal-only; HTTP responses expose only the dependency name and outcome.
type Dependency interface {
	Name() string
	Ping(context.Context) error
}
