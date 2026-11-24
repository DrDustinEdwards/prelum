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
export function website({ origin, name, description, searchUrl, publisher }: {
    origin: string;
    name: string;
    description?: string;
    searchUrl?: string;
    publisher?: SchemaNode;
}): Record<string, unknown>;
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
export function pageImage({ url, width, height, caption, creditText, creator, copyrightNotice, license, acquireLicensePage, }: ImageInput): SchemaNode;
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
/**
 * An Article's `image` set: one picture cut at each of Google's three ratios (site-runtime's ./image cuts them around the focal
 * point), each with the picture's rights. A crop whose size is not its ratio is refused, so a wrong URL cannot pass as one.
 *
 * @param {Partial<Record<typeof ARTICLE_IMAGE_RATIOS[number], { url: string, width: number, height: number }>>} crops
 * @param {Omit<ImageInput, "url" | "width" | "height">} [rights] caption, credit and license, the same on every crop
 * @returns {ImageInput[]}
 */
export function articleImageSet(crops: Partial<Record<(typeof ARTICLE_IMAGE_RATIOS)[number], {
    url: string;
    width: number;
    height: number;
}>>, rights?: Omit<ImageInput, "url" | "width" | "height">): ImageInput[];
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
export function videoObject({ name, thumbnailUrl, uploadDate, description, contentUrl, embedUrl, width, height, duration, transcript, }: VideoInput): SchemaNode;
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
export function article({ url, headline, description, image, published, modified, tags, author, publisher, type, }: ArticleInput): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(origin: string, trail: Array<{
    name: string;
    path: string;
}>): Record<string, unknown>;
/**
 * An ItemList of pages. An item's `description` is written when it has one, so a hub's list carries what each guide is for.
 *
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string, description?: string }>} items
 */
export function itemList(origin: string, name: string, items: Array<{
    name: string;
    path: string;
    description?: string;
}>): Record<string, unknown>;
/**
 * Profile links as schema.org `sameAs` wants them: absolute http(s) URLs, trimmed, each once, in the order given. Undefined
 * when none are left, since an empty list claims profiles the page does not have.
 *
 * @param {ReadonlyArray<string | null | undefined> | null | undefined} urls
 * @returns {string[] | undefined}
 */
export function sameAs(urls: ReadonlyArray<string | null | undefined> | null | undefined): string[] | undefined;
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
export function postalAddress(address: AddressInput | null | undefined): SchemaNode | undefined;
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
export function person(person: PersonInput): SchemaNode;
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
export function organization(organization: OrganizationInput): SchemaNode;
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
export function softwareApplication(app: SoftwareApplicationInput): SchemaNode;
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
export function podcastSeries(series: PodcastSeriesInput): SchemaNode;
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
export function podcastEpisode(episode: PodcastEpisodeInput): SchemaNode;
/**
 * @typedef {object} DatasetInput
 * @property {string} name what the data holds, not the page's short title
 * @property {string} description Google wants 50 to 5,000 characters
 * @property {string} url the page that shows the data
 * @property {string} [id]
 * @property {string | SchemaNode} [creator] a person's name, or their node
 * @property {string} [license] a URL
 * @property {boolean} [isAccessibleForFree] true only when the data is public with no sign-in
 * @property {ReadonlyArray<string>} [variableMeasured] what the data counts, as its columns say
 * @property {string} [temporalCoverage] ISO 8601, a date or an interval such as `1854-08-19/1854-09-30`
 * @property {string | SchemaNode} [spatialCoverage] a place's name, or its node
 * @property {ReadonlyArray<string | SchemaNode>} [citation] the sources the data was taken from
 * @property {ReadonlyArray<{ contentUrl: string, encodingFormat: string }>} [distribution] the downloads
 * @property {Date | number | string | null} [modified]
 */
/**
 * A Dataset (https://developers.google.com/search/docs/appearance/structured-data/dataset): `name` and `description` are
 * what Google requires, so they are required here; every other field is written only when given.
 *
 * @param {DatasetInput} data
 * @returns {SchemaNode}
 */
export function dataset(data: DatasetInput): SchemaNode;
/**
 * The schema.org type of a publication from its curated type (`article`, `review`, `abstract`, `chapter`,
 * `teaching-resource`), never from the journal's name. Anything else is a ScholarlyArticle, so a render does not fail on it.
 *
 * @param {string | null | undefined} type
 * @returns {string}
 */
export function scholarlyType(type: string | null | undefined): string;
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
export function scholarlyArticle(paper: ScholarlyPaper, context: {
    pageUrl: string;
    pdfUrl?: string | null | undefined;
    author?: ((name: string) => SchemaNode) | undefined;
    topics?: readonly {
        label: string;
    }[] | undefined;
}): SchemaNode;
/** Google's least for an Article image, width times height (https://developers.google.com/search/docs/appearance/structured-data/article). */
export const ARTICLE_IMAGE_MIN_PIXELS: 50000;
export { ARTICLE_IMAGE_RATIOS };
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
    creator?: {
        name: string;
        type?: "Person" | "Organization";
    } | undefined;
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
export type VideoInput = {
    /**
     * the video's title
     */
    name: string;
    /**
     * its poster, absolute
     */
    thumbnailUrl: string;
    uploadDate: Date | number | string;
    description?: string | undefined;
    /**
     * the file, absolute (a :::video)
     */
    contentUrl?: string | undefined;
    /**
     * the player (an ::embed)
     */
    embedUrl?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    /**
     * ISO 8601, e.g. `PT1M33S`
     */
    duration?: string | undefined;
    /**
     * the words, or a caption file's address
     */
    transcript?: string | undefined;
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
     * Google asks for several crops, 16:9, 4:3 and 1:1 (`articleImageSet` builds
     * them), each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and `height` are given and smaller is refused
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
    /**
     * the city
     */
    locality?: string | undefined;
    /**
     * the state or province
     */
    region?: string | undefined;
    postalCode?: string | undefined;
    /**
     * an ISO 3166-1 code, e.g. `US`
     */
    country?: string | undefined;
};
export type PersonInput = {
    name: string;
    /**
     * the node's `@id`, so a page, an article or a podcast can name the person by reference
     */
    id?: string | undefined;
    url?: string | undefined;
    honorificPrefix?: string | undefined;
    honorificSuffix?: string | undefined;
    jobTitle?: string | undefined;
    description?: string | undefined;
    /**
     * a URL, or ImageObject nodes (`pageImage`)
     */
    image?: string | Record<string, unknown> | (string | Record<string, unknown>)[] | undefined;
    /**
     * an organization's name, or its node or `{ "@id" }`
     */
    worksFor?: string | Record<string, unknown> | undefined;
    /**
     * the same
     */
    affiliation?: string | Record<string, unknown> | undefined;
    /**
     * the same
     */
    memberOf?: string | Record<string, unknown> | undefined;
    /**
     * organization names or nodes
     */
    alumniOf?: readonly (string | Record<string, unknown>)[] | undefined;
    knowsAbout?: readonly string[] | undefined;
    /**
     * run through `sameAs`
     */
    sameAs?: readonly (string | null | undefined)[] | undefined;
};
export type OrganizationInput = {
    name: string;
    id?: string | undefined;
    url?: string | undefined;
    description?: string | undefined;
    /**
     * a URL, or an ImageObject (`pageImage`); Google reads a logo at least 112 px square
     */
    logo?: string | Record<string, unknown> | undefined;
    /**
     * a person's name, or their node or `{ "@id" }`
     */
    founder?: string | Record<string, unknown> | undefined;
    /**
     * parts, or a PostalAddress node
     */
    address?: Record<string, unknown> | AddressInput | undefined;
    /**
     * the public contact address, written as a ContactPoint
     */
    email?: string | undefined;
    /**
     * what the contact is for; `customer support` unless given
     */
    contactType?: string | undefined;
    knowsAbout?: readonly string[] | undefined;
    /**
     * run through `sameAs`
     */
    sameAs?: readonly (string | null | undefined)[] | undefined;
};
export type SoftwareApplicationInput = {
    name: string;
    id?: string | undefined;
    url?: string | undefined;
    description?: string | undefined;
    /**
     * a schema.org category, e.g. `BusinessApplication`
     */
    applicationCategory?: string | undefined;
    /**
     * e.g. `Web`
     */
    operatingSystem?: string | undefined;
    /**
     * usually `{ "@id": ... }` of the Organization
     */
    publisher?: Record<string, unknown> | undefined;
    /**
     * only a price the page can honor; a product with no single price writes none
     */
    offers?: Record<string, unknown> | Record<string, unknown>[] | undefined;
};
export type PodcastSeriesInput = {
    name: string;
    /**
     * the show's page
     */
    url: string;
    id?: string | undefined;
    description?: string | undefined;
    /**
     * the artwork, absolute
     */
    image?: string | undefined;
    /**
     * the feed's address, absolute
     */
    webFeed?: string | undefined;
    /**
     * a person's name, or their node
     */
    author?: string | Record<string, unknown> | undefined;
    address?: Record<string, unknown> | AddressInput | undefined;
    /**
     * run through `sameAs`
     */
    sameAs?: readonly (string | null | undefined)[] | undefined;
};
export type PodcastEpisodeInput = {
    name: string;
    url: string;
    published?: string | number | Date | null | undefined;
    modified?: string | number | Date | null | undefined;
    description?: string | null | undefined;
    /**
     * absolute
     */
    image?: string | null | undefined;
    episodeNumber?: number | null | undefined;
    durationSeconds?: number | null | undefined;
    /**
     * the enclosure, as the feed gives it
     */
    audio?: {
        url: string;
        type?: string | null;
        bytes?: number | null;
    } | null | undefined;
    /**
     * the show, written as a PodcastSeries reference by name and URL
     */
    series?: {
        name: string;
        url?: string;
    } | undefined;
    /**
     * the episode's authors
     */
    hosts?: readonly {
        name: string;
        url?: string | null;
    }[] | undefined;
    /**
     * written as `actor`
     */
    guests?: readonly {
        name: string;
    }[] | undefined;
};
export type DatasetInput = {
    /**
     * what the data holds, not the page's short title
     */
    name: string;
    /**
     * Google wants 50 to 5,000 characters
     */
    description: string;
    /**
     * the page that shows the data
     */
    url: string;
    id?: string | undefined;
    /**
     * a person's name, or their node
     */
    creator?: string | Record<string, unknown> | undefined;
    /**
     * a URL
     */
    license?: string | undefined;
    /**
     * true only when the data is public with no sign-in
     */
    isAccessibleForFree?: boolean | undefined;
    /**
     * what the data counts, as its columns say
     */
    variableMeasured?: readonly string[] | undefined;
    /**
     * ISO 8601, a date or an interval such as `1854-08-19/1854-09-30`
     */
    temporalCoverage?: string | undefined;
    /**
     * a place's name, or its node
     */
    spatialCoverage?: string | Record<string, unknown> | undefined;
    /**
     * the sources the data was taken from
     */
    citation?: readonly (string | Record<string, unknown>)[] | undefined;
    /**
     * the downloads
     */
    distribution?: readonly {
        contentUrl: string;
        encodingFormat: string;
    }[] | undefined;
    modified?: string | number | Date | null | undefined;
};
export type ScholarlyPaper = {
    title: string;
    authors: readonly string[];
    year?: number | null | undefined;
    /**
     * a partial ISO date (`2011`, `2011-04`) is kept as deposited
     */
    publishedDate?: string | null | undefined;
    journal?: string | null | undefined;
    volume?: string | number | null | undefined;
    issue?: string | number | null | undefined;
    firstPage?: string | null | undefined;
    lastPage?: string | null | undefined;
    abstract?: string | null | undefined;
    doi?: string | null | undefined;
    type?: string | null | undefined;
    /**
     * the open-access answer (Unpaywall), not whether a PDF is hosted here
     */
    isOpenAccess?: boolean | undefined;
    license?: string | null | undefined;
};
import { ARTICLE_IMAGE_RATIOS } from "@dustinedwards/site-runtime/image";
