# remark-link-to-card
[remark](https://github.com/remarkjs/remark) plugin to convert text links to link cards.


## Usage

```bash
npm i remark-link-to-card
```

```js
import { unified } from "unified";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import remarkLinkToCard from 'remark-link-to-card'

const content = `
# Links

[GitHub](https://github.com/)

https://remark.js.org/

`

const parsedContent = await unified()
  .use(remarkParse)
  .use(remarkLinkToCard)
  .use(remarkHtml, { sanitize: false })
  .process(content);

console.log(parsedContent)

```

For the options available, please refer to [the jsdoc](./src/index.ts).

## Functionality

This plugin transforms the following markdown:

```markdown
https://remark.js.org/
```

to the following HTML:

```html
<a class="markdown-link-card-link" href="https://remark.js.org/">
  <div class="markdown-link-card-main">
    <div class="markdown-link-card-title">remark</div>
    <div class="markdown-link-card-description">
      Markdown processor powered by plugins
    </div>
    <div class="markdown-link-card-meta">
      <img class="markdown-link-card-favicon" src="https://www.google.com/s2/favicons?domain=remark.js.org" alt="remark.js.org favicon image" width="14" height="14">
      remark.js.org
    </div>
  </div>
  
  <div class="markdown-link-card-thumbnail">
    <img src="https://raw.githubusercontent.com/remarkjs/remark/website/screenshot.png" alt="remark" class="markdown-link-card-thumbnail-image">
  </div>
</a>
```

### Styling

You can write your custom styles for your cards.

We also provide some CSS extracted from [Zenn](https://zenn.dev/)'s styles for you to use.

```js
import 'remark-link-to-card/styles/link-card-base.css'
```

Refer to the [source code](./styles) for more details.


## License

MIT
