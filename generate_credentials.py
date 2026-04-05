#!/usr/bin/env python3
"""
Goulburn Admin Backend - Credential Generator
Generates secure credentials for production deployment
"""

import bcrypt
import pyotp
import secrets
import qrcode
from io import BytesIO
import base64


def generate_password_hash(password: str = None) -> tuple[str, str]:
    """Generate bcrypt hash for password"""
    if password is None:
        # Generate secure random password
        password = secrets.token_urlsafe(16)
    
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
    return password, hashed.decode()


def generate_totp_secret() -> tuple[str, str, str]:
    """Generate TOTP secret and QR code"""
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    
    # Generate provisioning URI
    uri = totp.provisioning_uri(
        name="admin@goulburn.ai",
        issuer_name="Goulburn Admin"
    )
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return secret, uri, qr_base64


def main():
    print("=" * 60)
    print("Goulburn Admin - Secure Credential Generator")
    print("=" * 60)
    print()
    
    # Generate password
    print("[1] Generating secure password...")
    password, password_hash = generate_password_hash()
    print(f"    Password: {password}")
    print(f"    Hash: {password_hash}")
    print()
    
    # Generate TOTP
    print("[2] Generating TOTP secret...")
    totp_secret, totp_uri, qr_code = generate_totp_secret()
    print(f"    TOTP Secret: {totp_secret}")
    print(f"    Setup URI: {totp_uri}")
    print()
    
    # Print environment variables
    print("=" * 60)
    print("Add these to your .env file:")
    print("=" * 60)
    print()
    print(f"ADMIN_USERNAME=admin")
    print(f"ADMIN_PASSWORD_HASH={password_hash}")
    print(f"ADMIN_TOTP_SECRET={totp_secret}")
    print()
    
    # Save QR code
    print("=" * 60)
    print("QR Code saved to: totp_qr.png")
    print("Scan with Google Authenticator or Authy")
    print("=" * 60)
    
    # Save QR code to file
    with open("totp_qr.png", "wb") as f:
        f.write(base64.b64decode(qr_code))
    
    # Save credentials to file
    with open("credentials.txt", "w") as f:
        f.write("Goulburn Admin Credentials\n")
        f.write("=" * 40 + "\n")
        f.write(f"Username: admin\n")
        f.write(f"Password: {password}\n")
        f.write(f"TOTP Secret: {totp_secret}\n")
        f.write("\n")
        f.write("Environment Variables:\n")
        f.write(f"ADMIN_USERNAME=admin\n")
        f.write(f"ADMIN_PASSWORD_HASH={password_hash}\n")
        f.write(f"ADMIN_TOTP_SECRET={totp_secret}\n")
    
    print()
    print("Credentials also saved to: credentials.txt")
    print("⚠️  KEEP THESE FILES SECURE AND DELETE AFTER USE!")


if __name__ == "__main__":
    try:
        main()
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install with: pip install bcrypt pyotp qrcode[pil]")
