FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/proslides-api ./cmd/api

FROM gcr.io/distroless/static-debian13:nonroot
WORKDIR /app
COPY --from=build /out/proslides-api /app/proslides-api

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/proslides-api"]
