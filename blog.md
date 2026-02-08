---
layout: default
title: Equity Dashboard
permalink: /equitydashboard/
---

<section class="section">
  <div class="container">
    <h1>Equity Dashboard</h1>
    <p class="subtitle">Small-cap signal dashboard and research updates.</p>

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
