/** @typedef {import("./schema-node.mjs").SchemaNode} SchemaNode */
/**
 * @typedef {object} AddressInput
 * @property {string} [streetAddress]
 * @property {string} [locality] the city
 * @property {string} [region] the state or province
 * @property {string} [postalCode]
 * @property {string} [country] an ISO 3166-1 code, e.g. `US`
 */
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
 * Profile links as schema.org `sameAs` wants them: absolute http(s) URLs, trimmed, each once, in the order given. Undefined
 * when none are left, since an empty list claims profiles the page does not have.
 *
 * @param {ReadonlyArray<string | null | undefined> | null | undefined} urls
 * @returns {string[] | undefined}
 */
export function sameAs(urls: ReadonlyArray<string | null | undefined> | null | undefined): string[] | undefined;
/**
 * A Person. A name given where an organization is wanted is written as an Organization; `sameAs` is cleaned, and every empty
 * field is dropped.
 *
 * @param {PersonInput} person
 * @returns {SchemaNode}
 */
export function person(person: PersonInput): SchemaNode;
/**
 * An Organization, for the home page and About, where Google reads its name and logo
 * (https://developers.google.com/search/docs/appearance/structured-data/organization).
 *
 * @param {OrganizationInput} organization
 * @returns {SchemaNode}
 */
export function organization(organization: OrganizationInput): SchemaNode;
/**
 * A PodcastSeries, tying the show to its feed.
 *
 * @param {PodcastSeriesInput} series
 * @returns {SchemaNode}
 */
export function podcastSeries(series: PodcastSeriesInput): SchemaNode;
/**
 * A PodcastEpisode. The length is `duration`, an ISO 8601 duration, on the episode and on its audio file (schema.org's
 * Episode and MediaObject both take it; `timeRequired` is for reading time). Dates come from `articleDates`, as an Article's do.
 *
 * @param {PodcastEpisodeInput} episode
 * @returns {SchemaNode}
 */
export function podcastEpisode(episode: PodcastEpisodeInput): SchemaNode;
/**
 * A Dataset (https://developers.google.com/search/docs/appearance/structured-data/dataset): `name` and `description` are
 * what Google requires, so they are required here; every other field is written only when given.
 *
 * @param {DatasetInput} data
 * @returns {SchemaNode}
 */
export function dataset(data: DatasetInput): SchemaNode;
export type SchemaNode = import("./schema-node.mjs").SchemaNode;
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
