/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * @see https://www.aem.live/docs/admin.html#tag/preview/operation/updatePreview
 */
export async function preview(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/preview/${owner}/${repo}/${ref}${path}`, { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`Failed to update preview for ${path}`);
  }
}

/**
 * @see https://www.aem.live/docs/admin.html#tag/preview/operation/deletePreview
 */
export async function unpreview(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/preview/${owner}/${repo}/${ref}${path}`, { method: 'DELETE' });
  if (!resp.ok) {
    throw new Error(`Failed to update preview for ${path}`);
  }
}

/**
 * @see https://www.aem.live/docs/admin.html#tag/publish/operation/publishResource
 */
export async function publish(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/live/${owner}/${repo}/${ref}${path}`, { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`Failed to publish ${path}`);
  }
}

/**
 * @see https://www.aem.live/docs/admin.html#tag/publish/operation/unpublishResource
 */
export async function unpublish(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/live/${owner}/${repo}/${ref}${path}`, { method: 'DELETE' });
  if (!resp.ok) {
    throw new Error(`Failed to publish ${path}`);
  }
}

/**
 * @see https://www.aem.live/docs/admin.html#tag/cache/operation/purgeCache
 */
export async function clearCache(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/cache/${owner}/${repo}/${ref}${path}`, { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`Failed to publish ${path}`);
  }
}

/**
 * @see https://www.aem.live/docs/admin.html#tag/status/operation/status
 */
export async function status(skConfig, path) {
  const { owner, repo, ref } = skConfig.config;
  const resp = await fetch(`https://admin.hlx.page/status/${owner}/${repo}/${ref}${path}`);
  if (!resp.ok) {
    throw new Error(`Failed to get status for ${path}`);
  }
  return resp.json();
}
