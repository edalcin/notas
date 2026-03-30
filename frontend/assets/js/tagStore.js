// Shared tag state — avoids circular imports between hashtags.js and notes.js/editor.js

let _tags = [];

export function setTags(hashtags) {
  _tags = hashtags || [];
}

export function getTags() {
  return _tags;
}

export function getTagColor(name) {
  return _tags.find(t => t.name === name)?.color || '';
}
