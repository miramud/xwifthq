import { describe, expect, it } from "vitest";
import { isRichBlank, isRichHtml, linesToRichList, plainToHtml, richExcerpt, richToLines, richToPlain, sanitizeRichHtml, toEditorHtml } from "./richText";

describe("rich text", () => {
  it("keeps the structure a writer gave their text", () => {
    const html =
      '<h2 style="text-align: center">Budget</h2><p>We need <strong>₦2m</strong> &amp; <em>more</em>.</p>' +
      '<ul><li>One</li><li>Two<ol><li>a</li></ol></li></ul><blockquote><p>Quoted</p></blockquote>' +
      '<table><tbody><tr><th colspan="2">Item</th></tr><tr><td>Desk</td><td style="text-align: right">4</td></tr></tbody></table>';

    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("lets nothing that runs code through", () => {
    const clean = sanitizeRichHtml(
      '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">one</a> ' +
        '<a href="java&#x09;script:alert(1)">two</a><img src="x" onerror="alert(1)"><iframe src="//evil.test"></iframe>' +
        '<svg><script>1</script></svg><span style="color: #ff0000; background: url(//evil.test)">red</span>',
    );

    for (const bad of ["script", "onclick", "onerror", "javascript", "iframe", "svg", "<img", "url("]) {
      expect(clean.toLowerCase()).not.toContain(bad);
    }
    expect(clean).toContain('<span style="color: #ff0000">red</span>');
    expect(clean).toContain("one two");
  });

  it("opens links in a new tab without handing over the page", () => {
    expect(sanitizeRichHtml('<a href="https://example.com" target="_self">policy</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">policy</a>',
    );
  });

  it("tells markup from plain text written before the editor", () => {
    expect(isRichHtml("<p>Hi</p>")).toBe(true);
    expect(isRichHtml("5 < 6 and <3")).toBe(false);
    expect(isRichHtml("<iframe src=x></iframe>")).toBe(true);
    expect(toEditorHtml("One\ntwo\n\nThree & <four>")).toBe("<p>One<br>two</p><p>Three &amp; &lt;four&gt;</p>");
    expect(plainToHtml("   ")).toBe("");
  });

  it("knows an editor left empty is no answer", () => {
    expect(isRichBlank("<p></p>")).toBe(true);
    expect(isRichBlank("<p> <br> </p>")).toBe(true);
    expect(isRichBlank("<p>&nbsp;</p>")).toBe(true);
    expect(isRichBlank("<p>Yes</p>")).toBe(false);
    expect(isRichBlank("  ")).toBe(true);
    expect(isRichBlank(null)).toBe(true);
  });

  it("reads as words for previews", () => {
    const html = "<h3>Ask</h3><p>Buy <strong>desks</strong> &amp; chairs</p><ul><li>Ten</li><li>Fast</li></ul>";
    expect(richToPlain(html)).toBe("Ask\nBuy desks & chairs\n\n- Ten\n- Fast");
    expect(richExcerpt(html, 20)).toBe("Ask Buy desks &…");
    expect(richExcerpt("Short", 20)).toBe("Short");
  });

  it("turns a test case's steps into a numbered list and back, one plain step each", () => {
    const html = linesToRichList(["Sign in as Ada", "Open <Leave>"]);
    expect(html).toBe("<ol><li><p>Sign in as Ada</p></li><li><p>Open &lt;Leave&gt;</p></li></ol>");
    expect(richToLines(html)).toEqual(["Sign in as Ada", "Open <Leave>"]);

    expect(richToLines("<ol><li><p>Open <strong>Leave</strong></p><ul><li>Annual</li></ul></li><li>Submit</li></ol>")).toEqual(["Open Leave", "Annual", "Submit"]);
    expect(richToLines("<p>First</p><p>Second<br>Third</p>")).toEqual(["First", "Second", "Third"]);
    expect(richToLines("1. One\n- Two\n\nThree")).toEqual(["One", "Two", "Three"]);
    expect(linesToRichList([" ", ""])).toBe("");
  });
});
