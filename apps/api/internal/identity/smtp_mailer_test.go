package identity

import (
	"bufio"
	"context"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestSMTPMailerDeliversVerificationWithoutLoggingOrExternalNetwork(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	messages := make(chan string, 1)
	go func() {
		connection, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer connection.Close()
		reader := bufio.NewReader(connection)
		_, _ = connection.Write([]byte("220 test ESMTP\r\n"))
		var message strings.Builder
		inData := false
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				return
			}
			trimmed := strings.TrimRight(line, "\r\n")
			if inData {
				if trimmed == "." {
					messages <- message.String()
					_, _ = connection.Write([]byte("250 stored\r\n"))
					inData = false
				} else {
					message.WriteString(line)
				}
				continue
			}
			switch {
			case strings.HasPrefix(trimmed, "EHLO"):
				_, _ = connection.Write([]byte("250-test\r\n250 OK\r\n"))
			case strings.HasPrefix(trimmed, "MAIL FROM:"), strings.HasPrefix(trimmed, "RCPT TO:"):
				_, _ = connection.Write([]byte("250 OK\r\n"))
			case trimmed == "DATA":
				inData = true
				_, _ = connection.Write([]byte("354 send\r\n"))
			case trimmed == "QUIT":
				_, _ = connection.Write([]byte("221 bye\r\n"))
				return
			default:
				_, _ = connection.Write([]byte("250 OK\r\n"))
			}
		}
	}()
	host, rawPort, _ := net.SplitHostPort(listener.Addr().String())
	port, _ := strconv.Atoi(rawPort)
	mailer, err := NewSMTPMailer(SMTPConfig{Host: host, Port: port, FromAddress: "no-reply@example.test", FromName: "ProSlides", Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	if err = mailer.SendVerification(context.Background(), "user@example.test", "123456", 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	select {
	case message := <-messages:
		if !strings.Contains(message, "123456") || !strings.Contains(message, "user@example.test") {
			t.Fatalf("unexpected message: %q", message)
		}
	case <-time.After(time.Second):
		t.Fatal("SMTP message not received")
	}
}

func TestSMTPMailerRejectsUnsafeConfigurationAndHeaders(t *testing.T) {
	if _, err := NewSMTPMailer(SMTPConfig{Host: "smtp.example.test", Port: 465, FromAddress: "no-reply@example.test", UseTLS: true, UseSSL: true}); err == nil {
		t.Fatal("conflicting TLS modes accepted")
	}
	if _, err := NewSMTPMailer(SMTPConfig{Host: "smtp.example.test", Port: 25, FromAddress: "no-reply@example.test", Username: "user"}); err == nil {
		t.Fatal("plaintext SMTP authentication accepted")
	}
	mailer := &SMTPMailer{config: SMTPConfig{}}
	if err := mailer.send(context.Background(), "victim@example.test\r\nBcc: attacker@example.test", "subject", "body"); err == nil {
		t.Fatal("header injection accepted")
	}
}
