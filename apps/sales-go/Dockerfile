# CresOS sales-go workspace
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/sales-go ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/sales-go /app/sales-go
ENV PORT=4100
EXPOSE 4100
USER nonroot:nonroot
ENTRYPOINT ["/app/sales-go"]
