"""
Article Clustering with HDBSCAN
Groups related articles for brief generation using density-based clustering
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple
import hdbscan
from sklearn.preprocessing import normalize
import logging

logger = logging.getLogger(__name__)


@dataclass
class Article:
    """Article data for clustering"""
    id: int
    title: str
    content: str
    embedding: Optional[np.ndarray] = None
    published_at: Optional[str] = None
    source_id: Optional[int] = None
    topics: Optional[List[str]] = None


@dataclass
class Cluster:
    """Article cluster with metadata"""
    id: int
    articles: List[Article]
    centroid: np.ndarray
    label: str
    summary: Optional[str] = None
    significance: float = 0.0
    coherence: float = 0.0


@dataclass
class ClusteringConfig:
    """HDBSCAN clustering configuration"""
    min_cluster_size: int = 3
    min_samples: int = 2
    metric: str = "cosine"
    cluster_selection_epsilon: float = 0.0
    cluster_selection_method: str = "eom"  # excess of mass
    prediction_data: bool = True

    # Post-processing
    min_coherence: float = 0.3
    max_clusters: int = 20
    merge_threshold: float = 0.8


class ArticleClusterer:
    """
    HDBSCAN-based article clustering for brief generation

    Features:
    - Density-based clustering (no need to specify K)
    - Noise detection (outlier articles)
    - Soft clustering with membership probabilities
    - Hierarchical structure for multi-level grouping
    """

    def __init__(self, config: Optional[ClusteringConfig] = None):
        self.config = config or ClusteringConfig()
        self.clusterer: Optional[hdbscan.HDBSCAN] = None
        self.clusters: List[Cluster] = []

    def fit(self, articles: List[Article]) -> List[Cluster]:
        """
        Cluster articles based on their embeddings

        Args:
            articles: List of articles with embeddings

        Returns:
            List of clusters with assigned articles
        """
        if len(articles) < self.config.min_cluster_size:
            logger.warning(f"Not enough articles for clustering: {len(articles)}")
            return self._create_single_cluster(articles)

        # Get embeddings
        embeddings = self._extract_embeddings(articles)
        if embeddings is None:
            logger.error("No valid embeddings found")
            return []

        # Normalize embeddings for cosine similarity
        embeddings_normalized = normalize(embeddings)

        # Initialize HDBSCAN
        self.clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.config.min_cluster_size,
            min_samples=self.config.min_samples,
            metric=self.config.metric,
            cluster_selection_epsilon=self.config.cluster_selection_epsilon,
            cluster_selection_method=self.config.cluster_selection_method,
            prediction_data=self.config.prediction_data,
        )

        # Fit and predict
        labels = self.clusterer.fit_predict(embeddings_normalized)
        probabilities = self.clusterer.probabilities_

        # Build clusters
        self.clusters = self._build_clusters(articles, embeddings, labels, probabilities)

        # Post-process clusters
        self.clusters = self._post_process_clusters(self.clusters)

        logger.info(f"Created {len(self.clusters)} clusters from {len(articles)} articles")

        return self.clusters

    def _extract_embeddings(self, articles: List[Article]) -> Optional[np.ndarray]:
        """Extract embeddings from articles"""
        embeddings = []
        for article in articles:
            if article.embedding is not None:
                embeddings.append(article.embedding)
            else:
                logger.warning(f"Article {article.id} has no embedding")

        if not embeddings:
            return None

        return np.array(embeddings)

    def _build_clusters(
        self,
        articles: List[Article],
        embeddings: np.ndarray,
        labels: np.ndarray,
        probabilities: np.ndarray,
    ) -> List[Cluster]:
        """Build cluster objects from HDBSCAN results"""
        clusters = []
        unique_labels = set(labels)

        for label in unique_labels:
            if label == -1:  # Skip noise
                continue

            # Get articles in this cluster
            mask = labels == label
            cluster_articles = [a for a, m in zip(articles, mask) if m]
            cluster_embeddings = embeddings[mask]
            cluster_probs = probabilities[mask]

            # Calculate centroid
            centroid = np.mean(cluster_embeddings, axis=0)

            # Calculate coherence (average similarity to centroid)
            coherence = self._calculate_coherence(cluster_embeddings, centroid)

            # Calculate significance based on size and coherence
            significance = self._calculate_significance(
                len(cluster_articles), coherence, cluster_probs
            )

            # Generate preliminary label
            cluster_label = self._generate_cluster_label(cluster_articles)

            cluster = Cluster(
                id=label,
                articles=cluster_articles,
                centroid=centroid,
                label=cluster_label,
                coherence=coherence,
                significance=significance,
            )
            clusters.append(cluster)

        # Sort by significance
        clusters.sort(key=lambda c: c.significance, reverse=True)

        return clusters

    def _calculate_coherence(self, embeddings: np.ndarray, centroid: np.ndarray) -> float:
        """Calculate cluster coherence as average cosine similarity to centroid"""
        if len(embeddings) == 0:
            return 0.0

        # Normalize
        embeddings_norm = normalize(embeddings)
        centroid_norm = normalize(centroid.reshape(1, -1))

        # Cosine similarities
        similarities = np.dot(embeddings_norm, centroid_norm.T).flatten()

        return float(np.mean(similarities))

    def _calculate_significance(
        self,
        size: int,
        coherence: float,
        probabilities: np.ndarray,
    ) -> float:
        """
        Calculate cluster significance score

        Combines:
        - Cluster size (log-scaled)
        - Coherence (semantic similarity)
        - Membership probabilities
        """
        size_score = np.log1p(size) / np.log1p(100)  # Normalize by expected max
        prob_score = float(np.mean(probabilities))

        # Weighted combination
        significance = (
            0.3 * size_score +
            0.4 * coherence +
            0.3 * prob_score
        )

        return min(1.0, significance)

    def _generate_cluster_label(self, articles: List[Article]) -> str:
        """Generate a preliminary label for the cluster based on common topics"""
        if not articles:
            return "Uncategorized"

        # Collect all topics
        all_topics = []
        for article in articles:
            if article.topics:
                all_topics.extend(article.topics)

        if not all_topics:
            # Fallback to first article title
            return articles[0].title[:50]

        # Find most common topic
        from collections import Counter
        topic_counts = Counter(all_topics)
        most_common = topic_counts.most_common(1)

        return most_common[0][0] if most_common else "Mixed Topics"

    def _post_process_clusters(self, clusters: List[Cluster]) -> List[Cluster]:
        """Post-process clusters: filter, merge, and limit"""
        # Filter by coherence
        clusters = [c for c in clusters if c.coherence >= self.config.min_coherence]

        # Merge similar clusters
        clusters = self._merge_similar_clusters(clusters)

        # Limit number of clusters
        clusters = clusters[:self.config.max_clusters]

        return clusters

    def _merge_similar_clusters(self, clusters: List[Cluster]) -> List[Cluster]:
        """Merge clusters that are highly similar"""
        if len(clusters) <= 1:
            return clusters

        merged = []
        used = set()

        for i, c1 in enumerate(clusters):
            if i in used:
                continue

            # Find clusters to merge with this one
            to_merge = [c1]
            for j, c2 in enumerate(clusters[i + 1:], i + 1):
                if j in used:
                    continue

                similarity = self._cluster_similarity(c1, c2)
                if similarity >= self.config.merge_threshold:
                    to_merge.append(c2)
                    used.add(j)

            # Merge clusters
            if len(to_merge) > 1:
                merged_cluster = self._merge_clusters(to_merge)
                merged.append(merged_cluster)
            else:
                merged.append(c1)

            used.add(i)

        return merged

    def _cluster_similarity(self, c1: Cluster, c2: Cluster) -> float:
        """Calculate similarity between two clusters using centroids"""
        centroid1 = normalize(c1.centroid.reshape(1, -1))
        centroid2 = normalize(c2.centroid.reshape(1, -1))

        return float(np.dot(centroid1, centroid2.T)[0, 0])

    def _merge_clusters(self, clusters: List[Cluster]) -> Cluster:
        """Merge multiple clusters into one"""
        all_articles = []
        all_embeddings = []

        for cluster in clusters:
            all_articles.extend(cluster.articles)
            for article in cluster.articles:
                if article.embedding is not None:
                    all_embeddings.append(article.embedding)

        # New centroid
        centroid = np.mean(all_embeddings, axis=0) if all_embeddings else clusters[0].centroid

        # Combined metrics
        coherence = np.mean([c.coherence for c in clusters])
        significance = max(c.significance for c in clusters)

        return Cluster(
            id=clusters[0].id,
            articles=all_articles,
            centroid=centroid,
            label=clusters[0].label,  # Keep primary label
            coherence=coherence,
            significance=significance,
        )

    def _create_single_cluster(self, articles: List[Article]) -> List[Cluster]:
        """Create a single cluster when there aren't enough articles"""
        if not articles:
            return []

        embeddings = self._extract_embeddings(articles)
        if embeddings is None:
            return []

        centroid = np.mean(embeddings, axis=0)

        return [Cluster(
            id=0,
            articles=articles,
            centroid=centroid,
            label=self._generate_cluster_label(articles),
            coherence=1.0,
            significance=0.5,
        )]

    def get_noise_articles(self, articles: List[Article]) -> List[Article]:
        """Get articles that were classified as noise (outliers)"""
        if self.clusterer is None:
            return []

        labels = self.clusterer.labels_
        return [a for a, l in zip(articles, labels) if l == -1]

    def predict_cluster(self, article: Article) -> Tuple[int, float]:
        """
        Predict cluster for a new article

        Returns:
            Tuple of (cluster_id, probability)
        """
        if self.clusterer is None or article.embedding is None:
            return (-1, 0.0)

        embedding = normalize(article.embedding.reshape(1, -1))
        labels, probs = hdbscan.approximate_predict(self.clusterer, embedding)

        return (int(labels[0]), float(probs[0]))

    def get_cluster_hierarchy(self) -> Dict[str, Any]:
        """Get hierarchical structure of clusters"""
        if self.clusterer is None:
            return {}

        return {
            "condensed_tree": self.clusterer.condensed_tree_.to_dict() if hasattr(self.clusterer, "condensed_tree_") else None,
            "single_linkage_tree": self.clusterer.single_linkage_tree_.to_dict() if hasattr(self.clusterer, "single_linkage_tree_") else None,
        }


def cluster_articles_for_brief(
    articles: List[Dict[str, Any]],
    embeddings: np.ndarray,
    config: Optional[ClusteringConfig] = None,
) -> List[Dict[str, Any]]:
    """
    Convenience function to cluster articles for brief generation

    Args:
        articles: List of article dictionaries
        embeddings: Pre-computed embeddings as numpy array
        config: Optional clustering configuration

    Returns:
        List of cluster dictionaries with articles and metadata
    """
    # Convert to Article objects
    article_objs = []
    for i, article in enumerate(articles):
        article_objs.append(Article(
            id=article.get("id", i),
            title=article.get("title", ""),
            content=article.get("content", ""),
            embedding=embeddings[i] if i < len(embeddings) else None,
            published_at=article.get("published_at"),
            source_id=article.get("source_id"),
            topics=article.get("topics"),
        ))

    # Cluster
    clusterer = ArticleClusterer(config)
    clusters = clusterer.fit(article_objs)

    # Convert back to dictionaries
    result = []
    for cluster in clusters:
        result.append({
            "id": cluster.id,
            "label": cluster.label,
            "article_ids": [a.id for a in cluster.articles],
            "article_count": len(cluster.articles),
            "coherence": cluster.coherence,
            "significance": cluster.significance,
            "centroid": cluster.centroid.tolist(),
        })

    return result
