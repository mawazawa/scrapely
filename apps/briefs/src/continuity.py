"""
Brief continuity tracking for Meridian
Enables story arc tracking and previous day context
"""

import os
import requests
from typing import Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class BriefSummary:
    """Summary of a previous brief for continuity"""
    id: int
    title: str
    date: datetime
    tldr: str
    key_themes: List[str]


def fetch_previous_brief(api_url: str, secret_key: str) -> Optional[BriefSummary]:
    """Fetch the most recent brief for continuity context"""
    try:
        response = requests.get(
            f"{api_url}/reports/latest",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=30
        )
        if response.status_code != 200:
            print(f"[Continuity] No previous brief found: {response.status_code}")
            return None

        data = response.json()
        if not data:
            return None

        # Extract TLDR from content (look for ## TLDR or ## Summary section)
        content = data.get("content", "")
        tldr = extract_tldr(content)

        # Extract key themes from content
        themes = extract_themes(content)

        return BriefSummary(
            id=data.get("id"),
            title=data.get("title", ""),
            date=datetime.fromisoformat(data.get("createdAt", "").replace("Z", "+00:00")),
            tldr=tldr,
            key_themes=themes
        )
    except Exception as e:
        print(f"[Continuity] Error fetching previous brief: {e}")
        return None


def extract_tldr(content: str) -> str:
    """Extract TLDR/Summary section from brief content"""
    import re

    # Look for common summary section headers
    patterns = [
        r"## (?:TLDR|TL;DR|Summary|Key Takeaways)\s*\n(.*?)(?=\n## |\Z)",
        r"### (?:TLDR|TL;DR|Summary|Key Takeaways)\s*\n(.*?)(?=\n### |\n## |\Z)",
    ]

    for pattern in patterns:
        match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
        if match:
            tldr = match.group(1).strip()
            # Limit to reasonable length
            if len(tldr) > 500:
                tldr = tldr[:500] + "..."
            return tldr

    # Fallback: use first paragraph
    paragraphs = content.split("\n\n")
    for p in paragraphs:
        if len(p) > 50 and not p.startswith("#"):
            return p[:500] + ("..." if len(p) > 500 else "")

    return ""


def extract_themes(content: str) -> List[str]:
    """Extract key themes/topics from brief content"""
    import re

    themes = []

    # Look for section headers as themes
    headers = re.findall(r"^## (.+)$", content, re.MULTILINE)
    for header in headers[:5]:  # Limit to 5 themes
        # Clean up header
        theme = header.strip()
        if theme.lower() not in ["tldr", "tl;dr", "summary", "key takeaways", "sources"]:
            themes.append(theme)

    return themes


def generate_continuity_context(previous: Optional[BriefSummary]) -> str:
    """Generate context string for brief synthesis"""
    if not previous:
        return ""

    context = f"""
## Previous Brief Context (for continuity)

Yesterday's brief ({previous.date.strftime('%B %d, %Y')}): "{previous.title}"

Key themes covered:
{chr(10).join(f"- {theme}" for theme in previous.key_themes)}

Summary: {previous.tldr}

Use this context to:
1. Note any developing stories from yesterday
2. Highlight significant changes or updates
3. Provide continuity for ongoing narratives
4. Avoid redundant coverage of unchanged situations
"""
    return context


def get_continuity_prompt(api_url: str = None, secret_key: str = None) -> str:
    """Get continuity context for brief synthesis"""
    api_url = api_url or os.getenv("MERIDIAN_API_URL", "https://meridian-production.alceos.workers.dev")
    secret_key = secret_key or os.getenv("MERIDIAN_SECRET_KEY", "")

    if not secret_key:
        print("[Continuity] No secret key configured, skipping continuity")
        return ""

    previous = fetch_previous_brief(api_url, secret_key)
    return generate_continuity_context(previous)


# For testing
if __name__ == "__main__":
    context = get_continuity_prompt()
    print(context)
