// The entities a site describes about itself and its work: people, organizations, podcasts and datasets.

import { articleDates } from "./head.mjs";
import { isoDuration } from "./text.mjs";
import { thing, compact } from "./schema-node.mjs";

/** @import { SchemaNode } from "./schema.mjs" */

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
 * A PostalAddress node, for an Organization's or a series' `address`. An empty part is left out.
 *
 * @param {AddressInput | null | undefined} address
 * @returns {SchemaNode | undefined} undefined when there is nothing to say
 */
function postalAddress(address) {
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

/**
 * A Dataset (https://developers.google.com/search/docs/appearance/structured-data/dataset): `name` and `description` are
 * what Google requires, so they are required here; every other field is written only when given.
 *
 * @param {DatasetInput} data
 * @returns {SchemaNode}
 */
export function dataset(data) {
  return thing("Dataset", {
    "@id": data.id,
    name: data.name,
    description: data.description,
    url: data.url,
    creator: named(data.creator, "Person"),
    license: data.license,
    isAccessibleForFree: data.isAccessibleForFree,
    variableMeasured: data.variableMeasured ? [...data.variableMeasured] : undefined,
    temporalCoverage: data.temporalCoverage,
    spatialCoverage: named(data.spatialCoverage, "Place"),
    citation: data.citation ? [...data.citation] : undefined,
    distribution: data.distribution?.map((file) => ({ "@type": "DataDownload", ...file })),
    dateModified: articleDates({ modified: data.modified }).modified,
  });
}
