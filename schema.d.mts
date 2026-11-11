/**
 * @typedef {Record<string, unknown>} SchemaNode
 */
/**
 * The descriptor React Router's `meta` serializes into a `<script type="application/ld+json">`; `headHtml` writes the same.
 *
 * @param {SchemaNode} node
 * @returns {{ "script:ld+json": SchemaNode }}
 */
export function jsonLd(node: SchemaNode): {
  "script:ld+json": SchemaNode;
};
/**
 * Any schema.org type, with the context added and every empty field dropped: `undefined`, `null`, `""` and `[]` would each
 * claim a value the page does not have. Person, Organization, Book, Event and the rest are this, with the site's own fields.
 *
 * @param {string} type
 * @param {SchemaNode} fields
 * @returns {SchemaNode}
 */
export function thing(type: string, fields: SchemaNode): SchemaNode;
/**
 * Several nodes as one `@graph`, joined by their `@id`s, with the context written once.
 *
 * @param {SchemaNode[]} nodes
 * @returns {SchemaNode}
 */
export function graph(nodes: SchemaNode[]): SchemaNode;
/**
 * The site itself. There is no SearchAction unless `searchUrl` is given: one is a promise that the template is a working search.
 *
 * @param {{ origin: string, name: string, description?: string, searchUrl?: string, publisher?: SchemaNode }} site
 *   `searchUrl` holds `{search_term_string}` where the query goes
 */
export function website({
  origin,
  name,
  description,
  searchUrl,
  publisher,
}: {
  origin: string;
  name: string;
  description?: string;
  searchUrl?: string;
  publisher?: SchemaNode;
}): Record<string, unknown>;
/**
 * An image as an ImageObject, for `primaryImageOfPage` on a page that is not an article, or one of an Article's `image`s. Its
 * rights (`creditText`, `creator`, `copyrightNotice`, `license`, `acquireLicensePage`) are written when known.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode}
 */
export function pageImage({
  url,
  width,
  height,
  caption,
  creditText,
  creator,
  copyrightNotice,
  license,
  acquireLicensePage,
}: ImageInput): SchemaNode;
/**
 * An image's license metadata, which Google Images shows as its credit and Licensable badge
 * (https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata): null unless one of `creator`,
 * `creditText`, `copyrightNotice` or `license` is known, since Google requires one of them beside `contentUrl`. The badge
 * needs `license`, and `acquireLicensePage` is recommended with it. One node per licensable image on the page.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode | null}
 */
export function imageObject(image: ImageInput): SchemaNode | null;
/** Google's least for an Article image, width times height (https://developers.google.com/search/docs/appearance/structured-data/article). */
export const ARTICLE_IMAGE_MIN_PIXELS: 50000;
/** The crops Google asks an Article's image in, widest first. */
export const ARTICLE_IMAGE_RATIOS: readonly ["16x9", "4x3", "1x1"];
/**
 * An Article's `image` set: one picture cut at each of Google's three ratios, each with the picture's rights, in Google's order.
 * A crop whose size is not its ratio is refused.
 */
export function articleImageSet(
  crops: Partial<
    Record<(typeof ARTICLE_IMAGE_RATIOS)[number], { url: string; width: number; height: number }>
  >,
  rights?: Omit<ImageInput, "url" | "width" | "height">,
): ImageInput[];
export type VideoInput = {
  /** the video's title */
  name: string;
  /** its poster, absolute */
  thumbnailUrl: string;
  uploadDate: Date | number | string;
  description?: string | undefined;
  /** the file, absolute (a :::video) */
  contentUrl?: string | undefined;
  /** the player (an ::embed) */
  embedUrl?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** ISO 8601, e.g. `PT1M33S` */
  duration?: string | undefined;
  /** the words, or a caption file's address */
  transcript?: string | undefined;
};
/**
 * A VideoObject, which Google needs to show a video in results: `name`, `thumbnailUrl`, `uploadDate` and one of `contentUrl` or
 * `embedUrl` are required, and one missing is refused.
 */
export function videoObject(video: VideoInput): SchemaNode;
/**
 * @typedef {object} ArticleInput
 * @property {string} url
 * @property {string} headline
 * @property {string | null} [description]
 * @property {ArticleImage | ArticleImage[]} [image] Google asks for several crops, 16:9, 4:3 and 1:1 (`articleImageSet` builds
 *   them), each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and `height` are given and smaller is refused
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified]
 * @property {string[]} [tags]
 * @property {SchemaNode} [author]
 * @property {SchemaNode} [publisher]
 * @property {string} [type] `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
 */
/**
 * An article, with its dates from the same `articleDates` the Open Graph tags use. A URL image is written as it is, and an
 * `ImageInput` as `pageImage` writes it.
 *
 * @param {ArticleInput} article
 */
export function article({
  url,
  headline,
  description,
  image,
  published,
  modified,
  tags,
  author,
  publisher,
  type,
}: ArticleInput): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(
  origin: string,
  trail: Array<{
    name: string;
    path: string;
  }>,
): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string, description?: string }>} items
 */
export function itemList(
  origin: string,
  name: string,
  items: Array<{
    name: string;
    path: string;
    description?: string;
  }>,
): Record<string, unknown>;
/** @param {Array<{ question: string, answer: string }>} faqs */
export function faqPage(
  faqs: Array<{
    question: string;
    answer: string;
  }>,
): Record<string, unknown>;
export type SchemaNode = Record<string, unknown>;
export type ImageInput = {
  /**
   * the image file itself, absolute
   */
  url: string;
  /**
   * in pixels
   */
  width?: number | undefined;
  height?: number | undefined;
  caption?: string | undefined;
  /**
   * the name credited where the image is published
   */
  creditText?: string | undefined;
  /**
   * a Person unless `type` says Organization
   */
  creator?:
    | {
        name: string;
        type?: "Person" | "Organization";
      }
    | undefined;
  copyrightNotice?: string | undefined;
  /**
   * a page that says how the image may be used
   */
  license?: string | undefined;
  /**
   * a page that says how to license it
   */
  acquireLicensePage?: string | undefined;
};
/**
 * a URL, an image to write as an ImageObject, or a node `pageImage` built
 */
export type ArticleImage = string | ImageInput | SchemaNode;
export type ArticleInput = {
  url: string;
  headline: string;
  description?: string | null | undefined;
  /**
   * Google asks for several crops, 16:9, 4:3 and 1:1, each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and
   * `height` are given and smaller is refused
   */
  image?: ArticleImage | ArticleImage[] | undefined;
  published?: string | number | Date | null | undefined;
  modified?: string | number | Date | null | undefined;
  tags?: string[] | undefined;
  author?: Record<string, unknown> | undefined;
  publisher?: Record<string, unknown> | undefined;
  /**
   * `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
   */
  type?: string | undefined;
};
export type AddressInput = {
  streetAddress?: string | undefined;
  /** the city */
  locality?: string | undefined;
  /** the state or province */
  region?: string | undefined;
  postalCode?: string | undefined;
  /** an ISO 3166-1 code, e.g. `US` */
  country?: string | undefined;
};
export type PersonInput = {
  name: string;
  /** the node's `@id`, so a page, an article or a podcast can name the person by reference */
  id?: string | undefined;
  url?: string | undefined;
  honorificPrefix?: string | undefined;
  honorificSuffix?: string | undefined;
  jobTitle?: string | undefined;
  description?: string | undefined;
  /** a URL, or ImageObject nodes (`pageImage`) */
  image?: string | SchemaNode | Array<string | SchemaNode> | undefined;
  /** an organization's name, or its node or `{ "@id" }` */
  worksFor?: string | SchemaNode | undefined;
  affiliation?: string | SchemaNode | undefined;
  memberOf?: string | SchemaNode | undefined;
  alumniOf?: ReadonlyArray<string | SchemaNode> | undefined;
  knowsAbout?: readonly string[] | undefined;
  /** run through `sameAs` */
  sameAs?: ReadonlyArray<string | null | undefined> | undefined;
};
export type OrganizationInput = {
  name: string;
  id?: string | undefined;
  url?: string | undefined;
  description?: string | undefined;
  /** a URL, or an ImageObject (`pageImage`) */
  logo?: string | SchemaNode | undefined;
  /** a person's name, or their node or `{ "@id" }` */
  founder?: string | SchemaNode | undefined;
  /** parts, or a PostalAddress node */
  address?: AddressInput | SchemaNode | undefined;
  /** the public contact address, written as a ContactPoint */
  email?: string | undefined;
  /** what the contact is for; `customer support` unless given */
  contactType?: string | undefined;
  knowsAbout?: readonly string[] | undefined;
  /** run through `sameAs` */
  sameAs?: ReadonlyArray<string | null | undefined> | undefined;
};
export type SoftwareApplicationInput = {
  name: string;
  id?: string | undefined;
  url?: string | undefined;
  description?: string | undefined;
  /** a schema.org category, e.g. `BusinessApplication` */
  applicationCategory?: string | undefined;
  /** e.g. `Web` */
  operatingSystem?: string | undefined;
  /** usually `{ "@id": ... }` of the Organization */
  publisher?: SchemaNode | undefined;
  /** only a price the page can honor; a product with no single price writes none */
  offers?: SchemaNode | SchemaNode[] | undefined;
};
export type PodcastSeriesInput = {
  name: string;
  /** the show's page */
  url: string;
  id?: string | undefined;
  description?: string | undefined;
  /** the artwork, absolute */
  image?: string | undefined;
  /** the feed's address, absolute */
  webFeed?: string | undefined;
  /** a person's name, or their node */
  author?: string | SchemaNode | undefined;
  address?: AddressInput | SchemaNode | undefined;
  /** run through `sameAs` */
  sameAs?: ReadonlyArray<string | null | undefined> | undefined;
};
export type PodcastEpisodeInput = {
  name: string;
  url: string;
  published?: Date | number | string | null | undefined;
  modified?: Date | number | string | null | undefined;
  description?: string | null | undefined;
  /** absolute */
  image?: string | null | undefined;
  episodeNumber?: number | null | undefined;
  durationSeconds?: number | null | undefined;
  /** the enclosure, as the feed gives it */
  audio?:
    | { url: string; type?: string | null | undefined; bytes?: number | null | undefined }
    | null
    | undefined;
  /** the show, written as a PodcastSeries reference by name and URL */
  series?: { name: string; url?: string | undefined } | undefined;
  /** the episode's authors */
  hosts?: ReadonlyArray<{ name: string; url?: string | null | undefined }> | undefined;
  /** written as `actor` */
  guests?: ReadonlyArray<{ name: string }> | undefined;
};
export type ScholarlyPaper = {
  title: string;
  authors: readonly string[];
  year?: number | null | undefined;
  /** a partial ISO date (`2011`, `2011-04`) is kept as deposited */
  publishedDate?: string | null | undefined;
  journal?: string | null | undefined;
  volume?: string | number | null | undefined;
  issue?: string | number | null | undefined;
  firstPage?: string | null | undefined;
  lastPage?: string | null | undefined;
  abstract?: string | null | undefined;
  doi?: string | null | undefined;
  type?: string | null | undefined;
  /** the open-access answer (Unpaywall), not whether a PDF is hosted here */
  isOpenAccess?: boolean | undefined;
  license?: string | null | undefined;
};
/**
 * Profile links as schema.org `sameAs` wants them: absolute http(s) URLs, trimmed, each once, in the order given. Undefined
 * when none are left, since an empty list claims profiles the page does not have.
 */
export function sameAs(
  urls: ReadonlyArray<string | null | undefined> | null | undefined,
): string[] | undefined;
/** A PostalAddress node, for an Organization's or a series' `address`; undefined when there is nothing to say. */
export function postalAddress(address: AddressInput | null | undefined): SchemaNode | undefined;
/**
 * A Person. A name given where an organization is wanted is written as an Organization; `sameAs` is cleaned, and every empty
 * field is dropped.
 */
export function person(person: PersonInput): SchemaNode;
/** An Organization, for the home page and About: name, logo, founder, address, a ContactPoint and `sameAs`. */
export function organization(organization: OrganizationInput): SchemaNode;
/** A SoftwareApplication. `offers` is written only when given: a price a crawler reads is a promise. */
export function softwareApplication(app: SoftwareApplicationInput): SchemaNode;
/** A PodcastSeries, tying the show to its feed. */
export function podcastSeries(series: PodcastSeriesInput): SchemaNode;
/**
 * A PodcastEpisode. The length is `duration`, an ISO 8601 duration, on the episode and on its audio file; dates come from
 * `articleDates`, as an Article's do.
 */
export function podcastEpisode(episode: PodcastEpisodeInput): SchemaNode;
/**
 * The schema.org type of a publication from its curated type (`article`, `review`, `abstract`, `chapter`,
 * `teaching-resource`); anything else is a ScholarlyArticle.
 */
export function scholarlyType(type: string | null | undefined): string;
/**
 * A scholarly article, chapter or learning resource as one node: `@id` and `url` are its page, a DOI is its `identifier` and
 * `sameAs`, the journal a Periodical with volume and issue nested, a hosted PDF its `encoding`. Character references in the
 * record's text are decoded. `context.author` writes each author as a node (a site's owner as an `@id` reference); a Person
 * by name otherwise.
 */
export function scholarlyArticle(
  paper: ScholarlyPaper,
  context: {
    pageUrl: string;
    pdfUrl?: string | null | undefined;
    author?: ((name: string) => SchemaNode) | undefined;
    topics?: ReadonlyArray<{ label: string }> | undefined;
  },
): SchemaNode;
