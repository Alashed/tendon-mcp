#!/usr/bin/env python3
"""
Manually complete Tendon OAuth flow and inject token into Claude Code keychain.
Bypasses the browser — useful when Claude Code can't open a browser window.

Usage: python3 scripts/inject-mcp-token.py
"""

import json
import hashlib
import base64
import os
import secrets
import subprocess
import ast
import getpass
import urllib.request
import urllib.parse
import urllib.error
from urllib.parse import urlparse, parse_qs

API_URL = "https://api.tendon.alashed.kz"
MCP_URL = "https://mcp.tendon.alashed.kz"
REDIRECT_URI = "http://localhost:3333/callback"
KEYCHAIN_SERVICE = "Claude Code-credentials"

def http_post(url, data, headers=None):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        **(headers or {})
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def http_post_form(url, data, headers=None):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        **(headers or {})
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def generate_pkce():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b'=').decode()
    return verifier, challenge

def read_keychain():
    result = subprocess.run(
        ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return {}
    raw = result.stdout.strip()
    try:
        return json.loads(raw)
    except Exception:
        return {}

def write_keychain(data):
    val = json.dumps(data)
    result = subprocess.run(
        ["security", "add-generic-password", "-U",
         "-s", KEYCHAIN_SERVICE,
         "-a", KEYCHAIN_SERVICE,
         "-w", val],
        capture_output=True, text=True
    )
    return result.returncode == 0

def main():
    print("=== Tendon MCP Token Injector ===\n")

    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")

    print("\n1. Logging in...")
    try:
        login_res = http_post(f"{API_URL}/auth/login", {"email": email, "password": password})
        jwt = login_res["data"]["token"]
        print("   ✓ Logged in")
    except Exception as e:
        print(f"   ✗ Login failed: {e}")
        return

    print("2. Registering OAuth client...")
    try:
        client_res = http_post(f"{API_URL}/oauth/register", {
            "client_name": "claude-code-injected",
            "redirect_uris": [REDIRECT_URI],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none"
        })
        client_id = client_res["client_id"]
        print(f"   ✓ client_id: {client_id}")
    except Exception as e:
        print(f"   ✗ Client registration failed: {e}")
        return

    print("3. Generating PKCE...")
    verifier, challenge = generate_pkce()
    state = secrets.token_hex(8)
    print("   ✓ code_challenge generated")

    print("4. Getting authorization code...")
    consent_params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "scope": "mcp"
    }
    try:
        consent_res = http_post(
            f"{API_URL}/oauth/consent",
            consent_params,
            headers={"Authorization": f"Bearer {jwt}"}
        )
        redirect_url = consent_res["redirect_url"]
        parsed = urlparse(redirect_url)
        code = parse_qs(parsed.query)["code"][0]
        print(f"   ✓ auth code received")
    except Exception as e:
        print(f"   ✗ Consent failed: {e}")
        return

    print("5. Exchanging code for token...")
    try:
        token_res = http_post_form(f"{API_URL}/oauth/token", {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": client_id,
            "code_verifier": verifier,
        })
        access_token = token_res["access_token"]
        refresh_token = token_res.get("refresh_token", "")
        expires_in = token_res.get("expires_in", 2592000)
        import time
        expires_at = int(time.time() * 1000) + (expires_in * 1000)
        print(f"   ✓ access_token received (expires in {expires_in//86400}d)")
    except Exception as e:
        print(f"   ✗ Token exchange failed: {e}")
        return

    print("6. Writing to macOS Keychain...")
    creds = read_keychain()
    mcp_oauth = creds.get("mcpOAuth", {})
    if isinstance(mcp_oauth, str):
        try:
            mcp_oauth = ast.literal_eval(mcp_oauth)
        except Exception:
            mcp_oauth = {}

    # Use same key format as Claude Code: "serverName|fingerprint"
    server_key = f"tendon|{hashlib.sha256(MCP_URL.encode()).hexdigest()[:16]}"

    mcp_oauth[server_key] = {
        "serverName": "tendon",
        "serverUrl": f"{MCP_URL}/mcp",
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at,
        "clientId": client_id,
        "discoveryState": {
            "authorizationServerUrl": API_URL,
            "resourceMetadataUrl": f"{MCP_URL}/.well-known/oauth-protected-resource"
        }
    }

    creds["mcpOAuth"] = mcp_oauth

    if write_keychain(creds):
        print(f"   ✓ Token injected under key: {server_key}")
    else:
        print("   ✗ Failed to write keychain")
        return

    print("\n✅ Done! Restart Claude Code and try calling a Tendon tool.")
    print("   The token is valid for 30 days.\n")

if __name__ == "__main__":
    main()
