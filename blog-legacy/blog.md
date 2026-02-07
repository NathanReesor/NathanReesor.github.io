---
layout: default
title: Blog
permalink: /blog/
---

<section class="section">
  <div class="container">
    <h1>Blog</h1>
    <p class="subtitle">Thoughts on building, learning, and shipping.</p>

    <div class="post-list">
      {% for post in site.posts %}
        <article class="post-preview">
          <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
          <p class="post-meta">{{ post.date | date: '%B %d, %Y' }}</p>
          <p>{{ post.excerpt | strip_html | truncate: 160 }}</p>
          <a class="text-link" href="{{ post.url | relative_url }}">Read more →</a>
        </article>
      {% endfor %}
    </div>
  </div>
</section>
