package identity

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host, Username, Password, FromAddress, FromName string
	Port                                            int
	UseTLS, UseSSL                                  bool
	Timeout                                         time.Duration
}
type SMTPMailer struct{ config SMTPConfig }

func NewSMTPMailer(config SMTPConfig) (*SMTPMailer, error) {
	if config.Host == "" || config.Port <= 0 || config.FromAddress == "" {
		return nil, errors.New("SMTP host, port, and from address are required")
	}
	if strings.ContainsAny(config.Host+config.FromAddress+config.FromName, "\r\n") {
		return nil, errors.New("SMTP configuration contains an unsafe header value")
	}
	if parsed, err := mail.ParseAddress(config.FromAddress); err != nil || parsed.Address != config.FromAddress {
		return nil, fmt.Errorf("invalid SMTP from address")
	}
	if config.UseTLS && config.UseSSL {
		return nil, errors.New("SMTP TLS and SSL are mutually exclusive")
	}
	if config.Username != "" && !config.UseTLS && !config.UseSSL {
		return nil, errors.New("SMTP authentication requires TLS or SSL")
	}
	if config.Timeout <= 0 {
		config.Timeout = 10 * time.Second
	}
	return &SMTPMailer{config: config}, nil
}

func (m *SMTPMailer) SendPasswordReset(ctx context.Context, recipient, link string) error {
	body := "A password reset was requested for your ProSlides account.\r\n\r\nOpen this secure, one-time link:\r\n" + link + "\r\n\r\nIf you did not request this, ignore this email."
	return m.send(ctx, recipient, "Reset your ProSlides password", body)
}
func (m *SMTPMailer) SendVerification(ctx context.Context, recipient, code string, ttl time.Duration) error {
	minutes := int(ttl.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 1
	}
	body := fmt.Sprintf("Your ProSlides verification code is: %s\r\n\r\nIt expires in %d minutes. Do not share this code.", code, minutes)
	return m.send(ctx, recipient, "Verify your ProSlides email", body)
}
func (m *SMTPMailer) send(ctx context.Context, recipient, subject, body string) error {
	if strings.ContainsAny(recipient+subject, "\r\n") {
		return errors.New("invalid email header")
	}
	if _, err := mail.ParseAddress(recipient); err != nil {
		return err
	}
	address := net.JoinHostPort(m.config.Host, fmt.Sprint(m.config.Port))
	dialer := &net.Dialer{Timeout: m.config.Timeout}
	var connection net.Conn
	var err error
	if m.config.UseSSL {
		connection, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{ServerName: m.config.Host, MinVersion: tls.VersionTLS12})
	} else {
		connection, err = dialer.DialContext(ctx, "tcp", address)
	}
	if err != nil {
		return err
	}
	defer connection.Close()
	if err = connection.SetDeadline(time.Now().Add(m.config.Timeout)); err != nil {
		return err
	}
	client, err := smtp.NewClient(connection, m.config.Host)
	if err != nil {
		return err
	}
	defer client.Close()
	if m.config.UseTLS {
		if err = client.StartTLS(&tls.Config{ServerName: m.config.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if m.config.Username != "" {
		if err = client.Auth(smtp.PlainAuth("", m.config.Username, m.config.Password, m.config.Host)); err != nil {
			return err
		}
	}
	if err = client.Mail(m.config.FromAddress); err != nil {
		return err
	}
	if err = client.Rcpt(recipient); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	from := m.config.FromAddress
	if m.config.FromName != "" {
		from = mime.QEncoding.Encode("utf-8", m.config.FromName) + " <" + m.config.FromAddress + ">"
	}
	message := "From: " + from + "\r\nTo: " + recipient + "\r\nSubject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + body + "\r\n"
	if _, err = w.Write([]byte(message)); err != nil {
		_ = w.Close()
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	return client.Quit()
}
