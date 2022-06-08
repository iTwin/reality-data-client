# Changelog

## 0.9.0 (2022-06-07)

### - Added new option `authorizationClient` to `RealityDataClientOptions`

Defines Authorization client to use to get access token to Context Share API (authority: <https://ims.bentley.com> )
When defined it will ignore accessToken from API parameters and will get an access token from this client.
