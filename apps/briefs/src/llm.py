"""
LLM Integration for Meridian Briefs
Supports multiple providers with GPT-5.2 as primary for synthesis

Models (Dec 2025):
- GPT-5.2 Thinking: Best for cluster synthesis, 80% fewer hallucinations
- Gemini 3 Pro: Deep analysis with adaptive thinking
- Gemini 3 Flash: Fast processing
"""

import os
from typing import Literal, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Provider clients
_openai_client: Optional[OpenAI] = None
_gemini_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    """Get OpenAI client for GPT-5.2"""
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def get_gemini_client() -> OpenAI:
    """Get Gemini client (OpenAI-compatible endpoint)"""
    global _gemini_client
    if _gemini_client is None:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not set")
        _gemini_client = OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    return _gemini_client


# Model configurations
MODELS = {
    # GPT-5.2 for synthesis (best reasoning, lowest hallucination)
    "gpt-5.2": {"provider": "openai", "model": "gpt-5.2"},
    "gpt-5.2-thinking": {"provider": "openai", "model": "gpt-5.2", "reasoning_effort": "high"},

    # Gemini 3 for analysis
    "gemini-3-pro": {"provider": "gemini", "model": "gemini-3-pro"},
    "gemini-3-flash": {"provider": "gemini", "model": "gemini-3-flash"},

    # Legacy fallbacks
    "gemini-2.5-pro": {"provider": "gemini", "model": "gemini-2.5-pro-preview-05-06"},
    "gemini-2.5-flash": {"provider": "gemini", "model": "gemini-2.5-flash"},
}

ModelName = Literal[
    "gpt-5.2",
    "gpt-5.2-thinking",
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]


def call_llm(
    model: ModelName,
    messages: list[dict],
    temperature: float = 0,
    max_tokens: Optional[int] = None,
) -> tuple[str, tuple[int, int]]:
    """
    Call LLM with specified model

    Args:
        model: Model name from MODELS dict
        messages: Chat messages
        temperature: Sampling temperature
        max_tokens: Max output tokens

    Returns:
        Tuple of (response text, (prompt_tokens, completion_tokens))
    """
    config = MODELS.get(model)
    if not config:
        raise ValueError(f"Unknown model: {model}")

    provider = config["provider"]
    model_id = config["model"]

    # Build request kwargs
    kwargs = {
        "model": model_id,
        "messages": messages,
        "n": 1,
        "temperature": temperature,
    }

    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    # Add reasoning effort for GPT-5.2 thinking mode
    if config.get("reasoning_effort"):
        kwargs["reasoning_effort"] = config["reasoning_effort"]

    # Get appropriate client
    if provider == "openai":
        client = get_openai_client()
    else:
        client = get_gemini_client()

    response = client.chat.completions.create(**kwargs)

    return response.choices[0].message.content, (
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
    )


def synthesize_brief(
    clusters_data: str,
    previous_tldr: Optional[str] = None,
    model: ModelName = "gpt-5.2-thinking",
) -> tuple[str, tuple[int, int]]:
    """
    Generate intelligence brief from clustered articles
    Uses GPT-5.2 Thinking for best reasoning and lowest hallucination

    Args:
        clusters_data: Formatted cluster analysis
        previous_tldr: Previous day's TLDR for continuity
        model: Model to use (default: gpt-5.2-thinking)

    Returns:
        Tuple of (brief markdown, token usage)
    """
    system_prompt = """You are an elite intelligence analyst creating presidential-level daily briefs.

Your briefs are:
- Analytical, not just descriptive
- Focused on "why it matters" and implications
- Objective and fact-based
- Actionable with clear watch items
- Written in an engaging but professional tone"""

    user_prompt = f"""Generate today's intelligence brief.

{"## Previous Day Context" + chr(10) + previous_tldr + chr(10) if previous_tldr else ""}

## Today's Clustered Stories
{clusters_data}

## Required Sections

### Executive Summary
- 3-5 bullet points of most critical developments
- Lead with highest-impact items

### Regional Analysis
Group by region (Americas, Europe, Asia-Pacific, Middle East, Africa)
For each significant story:
- What happened (facts only)
- Why it matters (analysis)
- What to watch (forward-looking)

### Emerging Patterns
- Cross-cutting themes across regions
- Trend indicators

### Watch Items
- Specific things to monitor in coming days
- Potential escalation points

### TLDR
- 2-3 sentence summary for continuity tracking

Format as clean markdown. Be concise but thorough."""

    return call_llm(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )


def analyze_cluster(
    cluster_articles: str,
    model: ModelName = "gemini-3-flash",
) -> tuple[str, tuple[int, int]]:
    """
    Deep analysis of a story cluster
    Uses Gemini 3 Flash for speed

    Args:
        cluster_articles: Articles in the cluster
        model: Model to use

    Returns:
        Tuple of (analysis, token usage)
    """
    prompt = f"""Analyze this cluster of related news articles.

{cluster_articles}

Provide:
1. **Core Narrative**: What is the central story?
2. **Key Facts**: Undisputed facts across sources
3. **Disputed Claims**: Where sources disagree
4. **Missing Context**: What's not being reported?
5. **Bias Indicators**: Any slant in coverage?
6. **Significance**: Why does this matter?

Be analytical and objective."""

    return call_llm(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
