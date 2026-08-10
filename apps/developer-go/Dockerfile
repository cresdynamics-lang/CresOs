# CresOS developer-go workspace
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/developer-go ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/developer-go /app/developer-go
ENV PORT=4200
EXPOSE 4200
USER nonroot:nonroot
ENTRYPOINT ["/app/developer-go"]
