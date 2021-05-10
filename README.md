# Zetkin javascript SDK
This is the javascript SDK for the Zetkin Platform for organizing activism. Use
it to build applications on top of the Zetkin Platform. The SDK can be used in
the browser (via Browserify) as well as in Node.

## At a glance
```javascript
Z.configure({
    clientId: 'my-client-id', // Contact Zetkin Foundation to get one
    clientSecret: 'my-client-secret',
});

// Get login URL and supply URL to redirect to after login
console.log(Z.getLoginUrl('http://example.com/restricted'));

// After logging in, back at example.com/restricted, with
// Express or other node-based HTTP framework
const callbackUrl = url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: req.path,
    query: req.query,
});

Z.authenticate(callbackUrl)
    .then(() => Z.resource('/users/me').get())
    .then(res => {
        console.log(res.data);
    });
```

## Installation
Install the Zetkin javascript SDK via npm.

```
npm install zetkin
```

## Authentication
The Zetkin API uses OAuth 2.0. That means that the user must be redirected to
login.zetk.in, and will return with an OAuth2 code provided in the URL. Use that
code (or in fact the entire URL) to authenticate the SDK.

The SDK will exchange the code for a token and then manage the token lifecycle
transparently.

```javascript
const callbackUrl = url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: req.path,
    query: req.query,
});

Z.authenticate(callbackUrl)
    .then(token => {
        // We get the token here, but we don't need to do anything with it since
        // the SDK will manage it internally.
    });
```

## Resource proxies and requests
In the SDK, API resources are represented by proxies created by the `resource()` function. Requests can be made to resources using methods on the proxy representing the HTTP verbs.

```javascript
Z.resource('/orgs/1/people').get();
```

### Request fundamentals
Requests return promises, which follow the normal promise conventions. Both the resolve and reject methods receive a single argument, an object with a `data` and a `httpStatus` attribute. A third attribute, `meta` is less self-explanatory but is covered later in this document.

The `data` attribute can be anything depending on what (if anything) was returned by the request, and the `httpStatus` attribute is the numeric HTTP response code.

```javascript
function onComplete(res) {
  console.log(res.data, res.httpStatus);
}
Z.resource('/orgs/1/people').get().then(onComplete);
```

Some HTTP verbs support request data, i.e. `POST`, `PUT` and `PATCH`. These request methods accept an (optional) argument, `data`, which will be serialized as JSON and sent in the request body.

```javascript
function onComplete(res) {
  console.log(res.data, res.httpStatus);
}

var requestData = { first_name: 'Clara' };
Z.resource('/orgs/1/people').post(requestData).then(onComplete);
```

### Composing resource paths
The resource path (e.g. `/orgs/1/people`) can be passed to `Z.resource()` as a string, or as an arguments list which will be joined with a slash delimiter. This is nice when you have variable segments and want to avoid string concatenation.

```javascript
var org_id = 1, person_id = 255;
var res0 = Z.resource('/orgs/' + org_id + '/people/' + person_id);
var res1 = Z.resource('orgs', org_id, 'people', person_id);

console.log(res0.getPath() === res1.getPath()); // true
```

Both methods yield the same result, but you might find the second version without the slashes and + signs nicer and easier to read.

### Adding query parameters
Query parameters may be passed to `Z.resource()` as an object. This has to be passed as the last argument.

```javascript
var res = Z.resource('orgs', 1, 'sub_organization', { recursive: true });

assert(res.getPath() === '/v1/orgs/1/sub_organization?recursive=true'); //true
```

Query parameters may also be combined with page arguments.

```javascript
// Makes a request to /v1/orgs/1/people?foo=bar&p=2&pp=100
var res = Z.resource('orgs', 1, 'people', { foo: 'bar'}).get(2, 100);
```

### Making the most of resource proxies
The objects returned by `Z.resource()` are called _resource proxies_. They can be reused for any number of requests, and even stored as part of your data model for shorter, more readable code.

```javascript
function Person(id) {
  // Constructor. Store the resource proxy on instance for reuse.
  this.resource = Z.resource('/orgs/1/people', id);
}

var person1 = new Person(1);
var person2 = new Person(2);

person1.resource.patch({ first_name: 'Clara' });
person2.resource.delete();
```

Whether this makes sense will depend on your application architecture, but ain't it nice to have options?

### Passing meta-data to callbacks
Oftentimes when your request finishes and the promise resolves you need to know more about the context in which the request was made. The resource proxy meta-data exists for this purpose. You can add any meta-data to a resource proxy and it will be passed in the `res` or `err` object when the promise is resolved or rejected.

```javascript
function onComplete(res) {
  console.log(res.meta.org_id); // 4
}

Z.resource('/orgs/4/people')
  .meta('org_id', 4)
  .get()
  .then(onComplete);
```

The `meta()` method can be passed a key-value pair like above, or a full object, in which case the contents will be copied to the internal meta object.

```javascript
Z.resource('/orgs/4/people').meta({
  // My custom meta-data
  org_id: 4,
  reason: 'search',
  redir_on_success: '/done'
}).get();
```

This allows you to send along complex meta-data to your callbacks.

## Advanced use
In most cases, nothing more than getting hold of the `Z` object and initializing via `initialize()` is necessary. However to some users, there might be cases where one would want to configure the SDK or create multiple instances to talk to separate back-ends.

### Reconfigure SDK
The `configure()` function allows some options to be reconfigured from their usually reasonable defaults.

```javascript
Z.configure({
  zetkinDomain: 'dev.zetkin.org',
  ssl: false
});
```
The options you might want to use are:
* `clientId`: Your client ID, as registered with Zetkin Foundation.
* `clientSecret`: Your client secret, as registered with Zetkin Foundation.
* `redirectUri`: The URI to which the user should be redirected after logging in. Can also be supplied to `getLoginUrl()`.
* `zetkinDomain`: The Zetkin domain. The default is api.zetk.in, but if you are developing Zetkin, you might want to use dev.zetkin.org.
* `host`: the host on which to connect with the API. The default is api.zetk.in.
* `port`: the port on which to connect with the API. The default is _443_ (or 80 if `ssl` is `false`)
* `ssl`: Whether to connect using HTTPS (true) or HTTP (false). The default is _true_, i.e. to connect securely using HTTPS.

### Running multiple instances
If your application requires several users to be authenticated at the same time (multiple sessions), or to have different requests be made to separate back-ends (multiple configurations) you can create separate instances. This is especially useful in a multi-user environment such as a server.

The `construct()` function creates a new `Z` instance and returns it. You will need to store a reference to it yourself.

```javascript
// Express server app
app.use((req, res, next) => {
    req.z = z.construct();
    next();
});
```

As a convenience, a `config` object can be passed to the `construct()` function directly.

```javascript
var DevZ = Z.construct({
  ssl: false
});
```

## Contributing
If you want to contribute to the Zetkin Javascript SDK, make a fork and use
`npm install` to install the dependencies. Make your changes, make sure that
they are properly tested and that all tests pass by running `npm test`, and
then make a pull request back to the master branch of this repository.
