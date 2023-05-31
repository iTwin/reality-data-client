# Change Log - @itwin/reality-data-client

This log was last generated on Wed, 31 May 2023 21:21:31 GMT and should not be manually modified.

<!-- Start content -->

## 1.0.0

Wed, 31 May 2023 21:21:31 GMT

### Major changes

- 1.0 release of iTwin/reality-data-client (aruniverse@users.noreply.github.com)

## 0.9.0 (2022-06-07)

### - Added new option `authorizationClient` to `RealityDataClientOptions`

Defines Authorization client to use to get access token to Context Share API (authority: <https://ims.bentley.com> )
When defined it will ignore accessToken from API parameters and will get an access token from this client.
