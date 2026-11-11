import { absoluteUrl, articleDates } from "./head.mjs";
import { isoDuration } from "./text.mjs";
import { toDate, unescapeXml } from "./xml.mjs";

const CONTEXT = "https://schema.org";

/**
 * @typedef {Record<string, unknown>} SchemaNode
 */

/**
 * The descriptor React Router's `meta` serializes into a `<script type="application/ld+json">`; `headHtml` writes the same.
 *
 * @param {SchemaNode} node
 * @returns {{ "script:ld+json": SchemaNode }}
 */
export function jsonLd(node) {
  return { "script:ld+json": node };
}

/**
 * Any schema.org type, with the context added and every empty field dropped: `undefined`, `null`, `""` and `[]` would each
 * claim a value the page does not have. Person, Organization, Book, Event and the rest are this, with the site's own fields.
 *
 * @param {string} type
 * @param {SchemaNode} fields
 * @returns {SchemaNode}
 */
export function thing(type, fields) {
  return { "@context": CONTEXT, "@type": type, ...compact(fields) };
}

/**
 * Several nodes as one `@graph`, joined by their `@id`s, with the context written once.
 *
 * @param {SchemaNode[]} nodes
 * @returns {SchemaNode}
 */
export function graph(nodes) {
  return {
    "@context": CONTEXT,
    "@graph": nodes.map((node) =>
      Object.fromEntries(Object.entries(node).filter(([key]) => key !== "@context")),
    ),
  };
}

/**
 * The site itself. There is no SearchAction unless `searchUrl` is given: one is a promise that the template is a working search.
 *
 * @param {{ origin: string, name: string, description?: string, searchUrl?: string, publisher?: SchemaNode }} site
 *   `searchUrl` holds `{search_term_string}` where the query goes
 */
export function website({ origin, name, description, searchUrl, publisher }) {
  return thing("WebSite", {
    "@id": `${origin}/#website`,
    url: origin,
    name,
    description,
    publisher,
    potentialAction: searchUrl
      ? {
          "@type": "SearchAction",
          target: searchUrl,
          "query-input": "required name=search_term_string",
        }
      : undefined,
  });
}

/** Google's least for an Article image, width times height (https://developers.google.com/search/docs/appearance/structured-data/article). */
export const ARTICLE_IMAGE_MIN_PIXELS = 50_000;

/**
 * @typedef {object} ImageInput
 * @property {string} url the image file itself, absolute
 * @property {number} [width] in pixels
 * @property {number} [height]
 * @property {string} [caption]
 * @property {string} [creditText] the name credited where the image is published
 * @property {{ name: string, type?: "Person" | "Organization" }} [creator] a Person unless `type` says Organization
 * @property {string} [copyrightNotice]
 * @property {string} [license] a page that says how the image may be used
 * @property {string} [acquireLicensePage] a page that says how to license it
 */

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
}) {
  return thing("ImageObject", {
    url,
    contentUrl: url,
    width,
    height,
    caption,
    creditText,
    creator: creator ? { "@type": creator.type ?? "Person", name: creator.name } : undefined,
    copyrightNotice,
    license,
    acquireLicensePage,
  });
}

/**
 * An image's license metadata, which Google Images shows as its credit and Licensable badge
 * (https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata): null unless one of `creator`,
 * `creditText`, `copyrightNotice` or `license` is known, since Google requires one of them beside `contentUrl`. The badge
 * needs `license`, and `acquireLicensePage` is recommended with it. One node per licensable image on the page.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode | null}
 */
export function imageObject(image) {
  const { creditText, creator, copyrightNotice, license } = image;
  return creditText || creator?.name || copyrightNotice || license ? pageImage(image) : null;
}

/** The crops Google asks an Article's image in, widest first (https://developers.google.com/search/docs/appearance/structured-data/article). */
export const ARTICLE_IMAGE_RATIOS = /** @type {const} */ (["16x9", "4x3", "1x1"]);

/**
 * An Article's `image` set: one picture cut at each of Google's three ratios (site-runtime's ./image cuts them around the focal
 * point), each with the picture's rights. A crop whose size is not its ratio is refused, so a wrong URL cannot pass as one.
 *
 * @param {Partial<Record<typeof ARTICLE_IMAGE_RATIOS[number], { url: string, width: number, height: number }>>} crops
 * @param {Omit<ImageInput, "url" | "width" | "height">} [rights] caption, credit and license, the same on every crop
 * @returns {ImageInput[]}
 */
export function articleImageSet(crops, rights = {}) {
  return ARTICLE_IMAGE_RATIOS.flatMap((ratio) => {
    const crop = crops[ratio];
    if (!crop) return [];
    const [w, h] = ratio.split("x").map(Number);
    if (Math.abs(crop.width / crop.height - (w ?? 1) / (h ?? 1)) > 0.01) {
      throw new Error(
        `article image ${crop.url} is ${crop.width}x${crop.height}, not ${ratio.replace("x", ":")}`,
      );
    }
    return [{ ...rights, ...crop }];
  });
}

/**
 * @typedef {object} VideoInput
 * @property {string} name the video's title
 * @property {string} thumbnailUrl its poster, absolute
 * @property {Date | number | string} uploadDate
 * @property {string} [description]
 * @property {string} [contentUrl] the file, absolute (a :::video)
 * @property {string} [embedUrl] the player (an ::embed)
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [duration] ISO 8601, e.g. `PT1M33S`
 * @property {string} [transcript] the words, or a caption file's address
 */

/**
 * A VideoObject, which Google needs to show a video in results (https://developers.google.com/search/docs/appearance/structured-data/video):
 * `name`, `thumbnailUrl` and `uploadDate` are required, and one of `contentUrl` or `embedUrl` lets Google fetch it. One missing is
 * refused rather than written as a node Google would drop.
 *
 * @param {VideoInput} video
 * @returns {SchemaNode}
 */
export function videoObject({
  name,
  thumbnailUrl,
  uploadDate,
  description,
  contentUrl,
  embedUrl,
  width,
  height,
  duration,
  transcript,
}) {
  const date = toDate(uploadDate, null);
  if (!name || !thumbnailUrl || Number.isNaN(date.getTime()) || !(contentUrl || embedUrl)) {
    throw new Error(
      `videoObject "${name}": name, thumbnailUrl, uploadDate and a contentUrl or embedUrl are required`,
    );
  }
  return thing("VideoObject", {
    name,
    description,
    thumbnailUrl,
    uploadDate: date.toISOString(),
    contentUrl,
    embedUrl,
    width,
    height,
    duration,
    transcript,
  });
}

/**
 * @typedef {string | ImageInput | SchemaNode} ArticleImage a URL, an image to write as an ImageObject, or a node `pageImage` built
 */

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
  type = "Article",
}) {
  const dates = articleDates({ published, modified });
  return thing(type, {
    headline,
    description,
    image: Array.isArray(image)
      ? image.map((each) => articleImage(url, each))
      : image && articleImage(url, image),
    datePublished: dates.published,
    dateModified: dates.modified,
    keywords: tags && tags.length > 0 ? tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author,
    publisher,
  });
}

/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(origin, trail) {
  return thing("BreadcrumbList", {
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(origin, crumb.path),
    })),
  });
}

/**
 * An ItemList of pages. An item's `description` is written when it has one, so a hub's list carries what each guide is for.
 *
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string, description?: string }>} items
 */
export function itemList(origin, name, items) {
  return thing("ItemList", {
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      description: item.description,
      url: absoluteUrl(origin, item.path),
    })),
  });
}

/** @param {Array<{ question: string, answer: string }>} faqs */
export function faqPage(faqs) {
  return thing("FAQPage", {
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  });
}

/**
 * Profile links as schema.org `sameAs` wants them: absolute http(s) URLs, trimmed, each once, in the order given. Undefined
 * when none are left, since an empty list claims profiles the page does not have.
 *
 * @param {ReadonlyArray<string | null | undefined> | null | undefined} urls
 * @returns {string[] | undefined}
 */
export function sameAs(urls) {
  /** @type {string[]} */
  const kept = [];
  for (const url of urls ?? []) {
    const trimmed = url?.trim();
    if (trimmed && /^https?:\/\/[^\s/]+/i.test(trimmed) && !kept.includes(trimmed))
      kept.push(trimmed);
  }
  return kept.length > 0 ? kept : undefined;
}

/**
 * @typedef {object} AddressInput
 * @property {string} [streetAddress]
 * @property {string} [locality] the city
 * @property {string} [region] the state or province
 * @property {string} [postalCode]
 * @property {string} [country] an ISO 3166-1 code, e.g. `US`
 */

/**
 * A PostalAddress node, for an Organization's or a series' `address`. An empty part is left out.
 *
 * @param {AddressInput | null | undefined} address
 * @returns {SchemaNode | undefined} undefined when there is nothing to say
 */
export function postalAddress(address) {
  if (!address) return undefined;
  const fields = compact({
    streetAddress: address.streetAddress,
    addressLocality: address.locality,
    addressRegion: address.region,
    postalCode: address.postalCode,
    addressCountry: address.country,
  });
  return Object.keys(fields).length > 0 ? { "@type": "PostalAddress", ...fields } : undefined;
}

/**
 * A name as a node: a string becomes `{ "@type": type, name }`; a node or an `{ "@id" }` reference is kept as it is.
 *
 * @param {string | SchemaNode | null | undefined} value
 * @param {string} type
 * @returns {SchemaNode | undefined}
 */
function named(value, type) {
  if (!value) return undefined;
  return typeof value === "string" ? { "@type": type, name: value } : value;
}

/**
 * @typedef {object} PersonInput
 * @property {string} name
 * @property {string} [id] the node's `@id`, so a page, an article or a podcast can name the person by reference
 * @property {string} [url]
 * @property {string} [honorificPrefix]
 * @property {string} [honorificSuffix]
 * @property {string} [jobTitle]
 * @property {string} [description]
 * @property {string | SchemaNode | Array<string | SchemaNode>} [image] a URL, or ImageObject nodes (`pageImage`)
 * @property {string | SchemaNode} [worksFor] an organization's name, or its node or `{ "@id" }`
 * @property {string | SchemaNode} [affiliation] the same
 * @property {string | SchemaNode} [memberOf] the same
 * @property {ReadonlyArray<string | SchemaNode>} [alumniOf] organization names or nodes
 * @property {readonly string[]} [knowsAbout]
 * @property {ReadonlyArray<string | null | undefined>} [sameAs] run through `sameAs`
 */

/**
 * A Person. A name given where an organization is wanted is written as an Organization; `sameAs` is cleaned, and every empty
 * field is dropped.
 *
 * @param {PersonInput} person
 * @returns {SchemaNode}
 */
export function person(person) {
  return thing("Person", {
    "@id": person.id,
    name: person.name,
    honorificPrefix: person.honorificPrefix,
    honorificSuffix: person.honorificSuffix,
    jobTitle: person.jobTitle,
    image: person.image,
    description: person.description,
    url: person.url,
    worksFor: named(person.worksFor, "Organization"),
    affiliation: named(person.affiliation, "Organization"),
    memberOf: named(person.memberOf, "Organization"),
    alumniOf: person.alumniOf?.map((each) => named(each, "Organization")),
    knowsAbout: person.knowsAbout ? [...person.knowsAbout] : undefined,
    sameAs: sameAs(person.sameAs),
  });
}

/**
 * @typedef {object} OrganizationInput
 * @property {string} name
 * @property {string} [id]
 * @property {string} [url]
 * @property {string} [description]
 * @property {string | SchemaNode} [logo] a URL, or an ImageObject (`pageImage`); Google reads a logo at least 112 px square
 * @property {string | SchemaNode} [founder] a person's name, or their node or `{ "@id" }`
 * @property {AddressInput | SchemaNode} [address] parts, or a PostalAddress node
 * @property {string} [email] the public contact address, written as a ContactPoint
 * @property {string} [contactType] what the contact is for; `customer support` unless given
 * @property {readonly string[]} [knowsAbout]
 * @property {ReadonlyArray<string | null | undefined>} [sameAs] run through `sameAs`
 */

/**
 * An Organization, for the home page and About, where Google reads its name and logo
 * (https://developers.google.com/search/docs/appearance/structured-data/organization).
 *
 * @param {OrganizationInput} organization
 * @returns {SchemaNode}
 */
export function organization(organization) {
  const address = organization.address;
  return thing("Organization", {
    "@id": organization.id,
    name: organization.name,
    url: organization.url,
    logo: organization.logo,
    description: organization.description,
    founder: named(organization.founder, "Person"),
    address: address && "@type" in address ? address : postalAddress(address),
    contactPoint: organization.email
      ? {
          "@type": "ContactPoint",
          email: organization.email,
          contactType: organization.contactType ?? "customer support",
        }
      : undefined,
    knowsAbout: organization.knowsAbout ? [...organization.knowsAbout] : undefined,
    sameAs: sameAs(organization.sameAs),
  });
}

/**
 * @typedef {object} SoftwareApplicationInput
 * @property {string} name
 * @property {string} [id]
 * @property {string} [url]
 * @property {string} [description]
 * @property {string} [applicationCategory] a schema.org category, e.g. `BusinessApplication`
 * @property {string} [operatingSystem] e.g. `Web`
 * @property {SchemaNode} [publisher] usually `{ "@id": ... }` of the Organization
 * @property {SchemaNode | SchemaNode[]} [offers] only a price the page can honor; a product with no single price writes none
 */

/**
 * A SoftwareApplication. `offers` is written only when given: a price a crawler reads is a promise.
 *
 * @param {SoftwareApplicationInput} app
 * @returns {SchemaNode}
 */
export function softwareApplication(app) {
  return thing("SoftwareApplication", {
    "@id": app.id,
    name: app.name,
    applicationCategory: app.applicationCategory,
    operatingSystem: app.operatingSystem,
    url: app.url,
    description: app.description,
    publisher: app.publisher,
    offers: app.offers,
  });
}

/**
 * @typedef {object} PodcastSeriesInput
 * @property {string} name
 * @property {string} url the show's page
 * @property {string} [id]
 * @property {string} [description]
 * @property {string} [image] the artwork, absolute
 * @property {string} [webFeed] the feed's address, absolute
 * @property {string | SchemaNode} [author] a person's name, or their node
 * @property {AddressInput | SchemaNode} [address]
 * @property {ReadonlyArray<string | null | undefined>} [sameAs] run through `sameAs`
 */

/**
 * A PodcastSeries, tying the show to its feed.
 *
 * @param {PodcastSeriesInput} series
 * @returns {SchemaNode}
 */
export function podcastSeries(series) {
  const address = series.address;
  return thing("PodcastSeries", {
    "@id": series.id,
    name: series.name,
    url: series.url,
    description: series.description,
    image: series.image,
    webFeed: series.webFeed,
    author: named(series.author, "Person"),
    address: address && "@type" in address ? address : postalAddress(address),
    sameAs: sameAs(series.sameAs),
  });
}

/**
 * @typedef {object} PodcastEpisodeInput
 * @property {string} name
 * @property {string} url
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified]
 * @property {string | null} [description]
 * @property {string | null} [image] absolute
 * @property {number | null} [episodeNumber]
 * @property {number | null} [durationSeconds]
 * @property {{ url: string, type?: string | null, bytes?: number | null } | null} [audio] the enclosure, as the feed gives it
 * @property {{ name: string, url?: string }} [series] the show, written as a PodcastSeries reference by name and URL
 * @property {ReadonlyArray<{ name: string, url?: string | null }>} [hosts] the episode's authors
 * @property {ReadonlyArray<{ name: string }>} [guests] written as `actor`
 */

/**
 * A PodcastEpisode. The length is `duration`, an ISO 8601 duration, on the episode and on its audio file (schema.org's
 * Episode and MediaObject both take it; `timeRequired` is for reading time). Dates come from `articleDates`, as an Article's do.
 *
 * @param {PodcastEpisodeInput} episode
 * @returns {SchemaNode}
 */
export function podcastEpisode(episode) {
  const dates = articleDates({ published: episode.published, modified: episode.modified });
  const duration = isoDuration(episode.durationSeconds);
  return thing("PodcastEpisode", {
    name: episode.name,
    url: episode.url,
    datePublished: dates.published,
    dateModified: dates.modified,
    description: episode.description,
    image: episode.image,
    episodeNumber: episode.episodeNumber || undefined,
    duration,
    associatedMedia: episode.audio
      ? {
          "@type": "MediaObject",
          contentUrl: episode.audio.url,
          encodingFormat: episode.audio.type ?? "audio/mpeg",
          contentSize: episode.audio.bytes ? String(episode.audio.bytes) : undefined,
          duration,
        }
      : undefined,
    partOfSeries: episode.series
      ? { "@type": "PodcastSeries", name: episode.series.name, url: episode.series.url }
      : undefined,
    author: episode.hosts?.map((host) => ({
      "@type": "Person",
      name: host.name,
      url: host.url || undefined,
    })),
    actor: episode.guests?.map((guest) => ({ "@type": "Person", name: guest.name })),
  });
}

// abstract is still a ScholarlyArticle: hiding abstracts on a site is editorial, not a claim about them.
/** @type {Record<string, string>} */
const SCHOLARLY_TYPES = {
  article: "ScholarlyArticle",
  review: "ScholarlyArticle",
  abstract: "ScholarlyArticle",
  chapter: "Chapter",
  "teaching-resource": "LearningResource",
};

/**
 * The schema.org type of a publication from its curated type (`article`, `review`, `abstract`, `chapter`,
 * `teaching-resource`), never from the journal's name. Anything else is a ScholarlyArticle, so a render does not fail on it.
 *
 * @param {string | null | undefined} type
 * @returns {string}
 */
export function scholarlyType(type) {
  return SCHOLARLY_TYPES[type ?? ""] ?? "ScholarlyArticle";
}

/**
 * @typedef {object} ScholarlyPaper
 * @property {string} title
 * @property {readonly string[]} authors
 * @property {number | null} [year]
 * @property {string | null} [publishedDate] a partial ISO date (`2011`, `2011-04`) is kept as deposited
 * @property {string | null} [journal]
 * @property {string | number | null} [volume]
 * @property {string | number | null} [issue]
 * @property {string | null} [firstPage]
 * @property {string | null} [lastPage]
 * @property {string | null} [abstract]
 * @property {string | null} [doi]
 * @property {string | null} [type]
 * @property {boolean} [isOpenAccess] the open-access answer (Unpaywall), not whether a PDF is hosted here
 * @property {string | null} [license]
 */

/**
 * A scholarly article, chapter or learning resource as one node: its `@id` and `url` are its page, a DOI is its
 * `identifier` and `sameAs`, the journal is a Periodical with its volume and issue nested as schema.org's own examples do,
 * and a hosted PDF is its `encoding`. Character references in the record's text (stored escaped) are decoded, since JSON-LD
 * needs no escaping and `jsonLd` makes it safe in a script element.
 *
 * @param {ScholarlyPaper} paper
 * @param {object} context
 * @param {string} context.pageUrl absolute URL of the paper's page
 * @param {string | null} [context.pdfUrl] absolute URL of the PDF, when hosted on the site
 * @param {(name: string) => SchemaNode} [context.author] each author as a node; a Person by name unless given. A site passes
 *   its owner's `{ "@id": ... }` reference here, so a co-author list is never replaced by the owner alone
 * @param {ReadonlyArray<{ label: string }>} [context.topics] written as `about`
 * @returns {SchemaNode}
 */
export function scholarlyArticle(paper, context) {
  const text = (/** @type {string | null | undefined} */ value) => unescapeXml(value ?? "");
  const title = text(paper.title);
  const volume = paper.volume ? String(paper.volume) : undefined;
  const issue = paper.issue ? String(paper.issue) : undefined;
  const issueNode = issue ? { "@type": "PublicationIssue", issueNumber: issue } : undefined;
  const volumeNode = volume
    ? { "@type": "PublicationVolume", volumeNumber: volume, hasPart: issueNode }
    : undefined;
  return thing(scholarlyType(paper.type), {
    "@id": context.pageUrl,
    headline: title,
    name: title,
    author: paper.authors.map(
      context.author ?? ((name) => ({ "@type": "Person", name: text(name) })),
    ),
    datePublished: paper.publishedDate ?? (paper.year ? String(paper.year) : undefined),
    url: context.pageUrl,
    mainEntityOfPage: context.pageUrl,
    identifier: paper.doi
      ? { "@type": "PropertyValue", propertyID: "DOI", value: paper.doi }
      : undefined,
    sameAs: paper.doi ? `https://doi.org/${paper.doi}` : undefined,
    isPartOf: paper.journal
      ? { "@type": "Periodical", name: text(paper.journal), hasPart: volumeNode }
      : undefined,
    pageStart: paper.firstPage,
    pageEnd: paper.lastPage,
    abstract: paper.abstract ? text(paper.abstract) : undefined,
    isAccessibleForFree: Boolean(paper.isOpenAccess),
    license: paper.license,
    encoding: context.pdfUrl
      ? { "@type": "MediaObject", encodingFormat: "application/pdf", contentUrl: context.pdfUrl }
      : undefined,
    about: context.topics?.map((topic) => ({ "@type": "Thing", name: topic.label })),
  });
}

/** @param {string} url the article's @param {ArticleImage} image @returns {string | SchemaNode} */
function articleImage(url, image) {
  if (typeof image === "string" || "@type" in image) return image;
  const { width, height } = /** @type {ImageInput} */ (image);
  if (width && height && width * height < ARTICLE_IMAGE_MIN_PIXELS) {
    throw new Error(
      `article ${url}: image ${image.url} is ${width}x${height}, under Google's ${ARTICLE_IMAGE_MIN_PIXELS} pixels`,
    );
  }
  return pageImage(/** @type {ImageInput} */ (image));
}

/** @param {SchemaNode} fields */
function compact(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );
}
