var url = require('url');
var http = require('http');
var https = require('https');
var ClientOAuth2 = require('client-oauth2')
var atob = require('atob');
var btoa = require('btoa');


/**
 * Zetkin API utility. Use the exported Z singleton, or create separate
 * instances using Z.construct().
*/
var Zetkin = function() {
    var _token = null;
    var _offsetSec = 0;
    var _client = null;
    var _config = {
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        zetkinDomain: 'zetk.in',
        accessTokenUri: '{PROTOCOL}://api.{ZETKIN_DOMAIN}/v{VERSION}/oauth/token/',
        authorizationUri: '{PROTOCOL}://api.{ZETKIN_DOMAIN}/v{VERSION}/oauth/authorize/',
        scopes: [],
        base: '',
        version: 1,
        ssl: true,
        host: 'api.{ZETKIN_DOMAIN}',
        port: undefined,
    }

    this.configure = function(options) {
        if (!options) {
            throw new Error('Options may not be undefined');
        }

        for (var key in options) {
            if (key in _config) {
                _config[key] = options[key];
            }
            else {
                throw new TypeError('Unknown config option: ' + key);
            }
        }

        if (_config.clientId) {
            _client = new ClientOAuth2({
                clientId: _config.clientId,
                clientSecret: _config.clientSecret,
                accessTokenUri: _config.accessTokenUri
                    .replace('{PROTOCOL}', _config.ssl? 'https' : 'http')
                    .replace('{VERSION}', _config.version)
                    .replace('{ZETKIN_DOMAIN}', _config.zetkinDomain),
                authorizationUri: _config.authorizationUri
                    .replace('{PROTOCOL}', _config.ssl? 'https' : 'http')
                    .replace('{VERSION}', _config.version)
                    .replace('{ZETKIN_DOMAIN}', _config.zetkinDomain),
                redirectUri: _config.redirectUri,
                scopes: [],
            });
        }
    }

    this.getConfig = function() {
        return _config;
    }

    function _validateClientConfiguration() {
        if (_client) {
            return true;
        }
        else {
            throw new Error('SDK client not configured');
        }
    }

    this.setToken = function(token) {
        _validateClientConfiguration();

        try {
            var data = JSON.parse(atob(token));
        }
        catch (err) {
            throw new Error('Malformed token');
        }

        _token = _client.createToken(data);
    }

    this.getToken = function() {
        _validateClientConfiguration();
        if (_token) {
            return btoa(JSON.stringify(_token.data));
        }

        return null;
    }

    this.setAccessToken = function(accessToken) {
        _validateClientConfiguration();
        _token = _client.createToken(accessToken, null, 'bearer');
    }

    this.setTokenData = function(data) {
        _validateClientConfiguration();
        _token = _client.createToken(data);
    }

    this.getTokenData = function() {
        _validateClientConfiguration();
        if (_token) {
            return _token.data;
        }

        return null;
    }

    this.getLoginUrl = function(redirectUri, scopes) {
        _validateClientConfiguration();

        var opts = {
            redirectUri: redirectUri,
            scopes: scopes,
        };

        return _config.clientSecret?
            _client.code.getUri(opts) : _client.token.getUri(opts);
    }

    this.authenticate = function(uri) {
        if (!uri) {
            throw new Error('Missing authentication redirect URL');
        }

        _validateClientConfiguration();

        // Remove code from URL (what's left should be redirect URL)
        var uriObj = url.parse(uri, true);
        delete uriObj.query.code;
        delete uriObj.search;

        var opts = {
            redirectUri: url.format(uriObj),
        };

        var promise = _config.clientSecret?
            _client.code.getToken(uri, opts) : _client.token.getToken(uri, opts);

        return promise
            .then(token => _token = token);
    }

    /**
     * Retrieve a resource proxy through which requests to that resource can be
     * made. An optional query object may be added as the last argument.
     *
     * Example: Z.resource('orgs', 1, 'people').get() will make a HTTP GET
     * request to the /orgs/1/people resource.
     *
     * Example: Z.resource('orgs', 1', 'sub_organizations', { recursive: true }) u
     * will make a HTTP GET request to /orgs/1/people?recursive
    */
    this.resource = function() {
        args = Array.prototype.filter.call(arguments, arg => typeof(arg) === 'string' || typeof(arg) === 'number');
        path = args.join('/');
        if (path.length == 0 || path[0] != '/') {
            path = '/' + path;
        }

        path = _config.base + '/v' + _config.version + path;

        query = [];

        if(args.length == arguments.length-1) {
            queryObject = arguments[arguments.length-1]
            if(typeof(queryObject) !== 'object') {
                throw new Error('Only the last argument of resource may be an object!')
            }
            query = Object.keys(queryObject)
                // Filter any keys with values that evaluate to false
                .filter(key => queryObject[key] !== false)
                .map(key => {
                    enckey = encodeURIComponent(key);
                    if(queryObject[key] === true) {
                        return enckey
                    } else {
                        return enckey + '=' + encodeURIComponent(queryObject[key]);
                    }
                });
        } else if(args.length != arguments.length) {
            throw new Error('Only one query object allowed!');
        }

        return new ZetkinResourceProxy(this, path, query, _request);
    };

    /**
     * Make request via HTTP or HTTPS depending on the configuration.
    */
    var _request = function(options, data, meta, ticket) {
        options.withCredentials = false;
        options.hostname = _config.host.replace('{ZETKIN_DOMAIN}', _config.zetkinDomain);
        options.port = _config.port || (_config.ssl? 443 : 80);
        options.ssl = _config.ssl;
        options.headers = options.headers || {};

        if (data) {
            options.headers['content-type'] = 'application/json';
        }

        if (_token) {
            _token.sign(options);
        }

        return requestPromise(options, data, meta)
            .catch(err => {
                if (err && err.httpStatus == 401) {
                    let originalError = err;
                    if (err.data && err.data.error == 'invalid_token') {
                        return _token
                            .refresh()
                            .then(token => {
                                _token = token;

                                // Re-sign and retry
                                _token.sign(options);
                                return requestPromise(options, data, meta);
                            })
                            .catch(err => {
                                // Try again without authorization altogether
                                delete options.headers.Authorization;
                                return requestPromise(options, data, meta);
                            })
                            .catch(err => {
                                throw originalError;
                            });
                    }
                    else {
                        // Try again without authorization
                        delete options.headers.Authorization;
                        return requestPromise(options, data, meta)
                            .catch(err => {
                                throw originalError;
                            });
                    }
                }

                throw err;
            });
    };
}


var ZetkinResourceProxy = function(z, path, query, _request) {
    var _meta = {};

    this.getPath = function() {
        const queryString = query.length > 0 ? '?' + query.join('&') : '';
        return path + queryString;
    };

    this.meta = function(keyOrObj, valueIfAny) {
        if (keyOrObj == null) {
            throw new Error(
                'Invalid meta() signature: Pass key and value or object');
        }
        else if (arguments.length == 1 && typeof keyOrObj == 'object') {
            var key;
            for (key in keyOrObj) {
                _meta[key] = keyOrObj[key];
            }
        }
        else if (arguments.length == 2) {
            _meta[keyOrObj] = valueIfAny;
        }
        else {
            throw new Error(
                'Invalid meta() signature: Pass key and value or object');
        }

        return this;
    };

    this.get = function(page, perPage, filters) {
        var opts = {
            method: 'GET',
            path: path,
        };

        if (page !== undefined && page !== null) {
            query.push('p=' + page || 0);

            if (perPage) {
                query.push('pp=' + perPage);
            }
        }

        if (filters) {
            if (filters.length >= 0) {
                for (var i = 0; i < filters.length; i++) {
                    if (filters[i].length !== 3) {
                        throw new Error(
                            'get() filters should be array of triplets');
                    }

                    var filter = filters[i].join('');
                    query.push('filter=' + encodeURIComponent(filter));
                }
            }
            else {
                throw new Error('get() filters should be array of triplets');
            }
        }

        if (query.length) {
            opts.path += '?' + query.join('&');
        }

        return _request(opts, null, _meta);
    };

    this.post = function(data) {
        var opts = {
            method: 'POST',
            path: path
        };

        return _request(opts, data, _meta);
    };

    this.patch = function(data) {
        var opts = {
            method: 'PATCH',
            path: path
        };

        return _request(opts, data, _meta);
    };

    this.del = function() {
        var opts = {
            method: 'DELETE',
            path: path
        };

        return _request(opts, null, _meta);
    };

    this.put = function(data) {
        var opts = {
            method: 'PUT',
            path: path
        };

        return _request(opts, data, _meta);
    };
};

function requestPromise(options, data, meta) {
    var client = options.ssl? https : http;

    return new Promise(function(resolve, reject) {
        req = client.request(options, function(res) {
            var json = '';

            if (res.setEncoding) {
                // The setEncoding() method may not exist, e.g. if running in
                // the browser using the Browserify abstraction layer.
                res.setEncoding('utf-8');
            }

            res.on('data', function(chunk) {
                json += chunk;
            });

            res.on('end', function() {
                var data;
                var success;

                try {
                  data = json? JSON.parse(json) : null;
                  success = (res.statusCode >= 200 && res.statusCode < 400);
                }
                catch (e) {
                  data = null;
                  success = false;
                }

                if (success) {
                    resolve({
                        data: data,
                        meta: meta,
                        httpStatus: res.statusCode
                    });
                }
                else {
                    reject({
                        data: data,
                        meta: meta,
                        httpStatus: res.statusCode
                    });
                }
            });
        });

        req.on('error', function(e) {
            reject(e);
        });

        if (data) {
            var json = JSON.stringify(data)
            req.write(json);
        }

        req.end();
    });
}


var Z = new Zetkin()

Z.construct = function(instanceOptions) {
    zetkin = new Zetkin();
    zetkin.configure(Z.getConfig());
    zetkin.configure(instanceOptions || {});
    return zetkin;
}

module.exports = Z;
