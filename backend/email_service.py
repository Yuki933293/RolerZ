"""
Email service — 邮件发送工具

支持两种模式（通过环境变量 EMAIL_PROVIDER 切换）：
1. smtp（默认）：使用 smtplib + QQ/163/Gmail 等 SMTP 服务
2. resend：使用 Resend API（需 pip install resend）

环境变量：
  EMAIL_PROVIDER    — smtp | resend（默认 smtp）
  SMTP_HOST         — SMTP 服务器地址（如 smtp.qq.com）
  SMTP_PORT         — SMTP 端口（默认 465）
  SMTP_USER         — 发件邮箱
  SMTP_PASSWORD     — 授权码（非登录密码）
  RESEND_API_KEY    — Resend API Key（仅 resend 模式）
  EMAIL_FROM        — 发件人显示名（默认 "RolerZ <noreply@rolerz.com>"）
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _get_from_addr() -> str:
    return os.environ.get("EMAIL_FROM", f"{os.environ.get('SMTP_USER', 'noreply@rolerz.com')}")


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an email. Returns True on success, False on failure."""
    provider = os.environ.get("EMAIL_PROVIDER", "smtp").lower()
    if provider == "resend":
        return _send_via_resend(to, subject, html_body)
    return _send_via_smtp(to, subject, html_body)


def _send_via_smtp(to: str, subject: str, html_body: str) -> bool:
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")

    if not all([host, user, password]):
        print("[EmailService] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = _get_from_addr()
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            server.login(user, password)
            server.sendmail(user, to, msg.as_string())
        return True
    except Exception as e:
        print(f"[EmailService] SMTP send failed: {e}")
        return False


def _send_via_resend(to: str, subject: str, html_body: str) -> bool:
    try:
        import resend  # type: ignore
    except ImportError:
        print("[EmailService] resend package not installed (pip install resend)")
        return False

    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        print("[EmailService] RESEND_API_KEY not set")
        return False

    resend.api_key = api_key
    try:
        resend.Emails.send({
            "from": _get_from_addr(),
            "to": [to],
            "subject": subject,
            "html": html_body,
        })
        return True
    except Exception as e:
        print(f"[EmailService] Resend send failed: {e}")
        return False


# ── Email templates ──────────────────────────────────────────────────

def verification_email_html(code: str, lang: str = "zh") -> tuple[str, str]:
    """Returns (subject, html_body) for verification code email."""
    if lang.startswith("zh"):
        subject = "RolerZ — 邮箱验证码"
        body = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">邮箱验证</h2>
            <p style="color: #666; font-size: 14px;">您的验证码是：</p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px;">验证码 15 分钟内有效，请勿泄露给他人。</p>
            <p style="color: #ccc; font-size: 11px; margin-top: 32px;">— RolerZ Team</p>
        </div>
        """
    else:
        subject = "RolerZ — Email Verification Code"
        body = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">Email Verification</h2>
            <p style="color: #666; font-size: 14px;">Your verification code is:</p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px;">This code is valid for 15 minutes. Do not share it.</p>
            <p style="color: #ccc; font-size: 11px; margin-top: 32px;">— RolerZ Team</p>
        </div>
        """
    return subject, body


def reset_password_email_html(code: str, lang: str = "zh") -> tuple[str, str]:
    """Returns (subject, html_body) for password reset code email."""
    if lang.startswith("zh"):
        subject = "RolerZ — 密码重置验证码"
        body = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">密码重置</h2>
            <p style="color: #666; font-size: 14px;">您正在重置密码，验证码如下：</p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ef4444;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px;">验证码 30 分钟内有效。如非本人操作，请忽略此邮件。</p>
            <p style="color: #ccc; font-size: 11px; margin-top: 32px;">— RolerZ Team</p>
        </div>
        """
    else:
        subject = "RolerZ — Password Reset Code"
        body = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">Password Reset</h2>
            <p style="color: #666; font-size: 14px;">You requested a password reset. Here is your code:</p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ef4444;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px;">This code is valid for 30 minutes. Ignore this email if you didn't request it.</p>
            <p style="color: #ccc; font-size: 11px; margin-top: 32px;">— RolerZ Team</p>
        </div>
        """
    return subject, body
