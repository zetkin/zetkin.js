'use strict';

const assert = require('assert');

const Z = require('../');


describe('resource()', () => {
    it('creates a resource proxy with the right methods', () => {
        let r = Z.resource('/users/me');

        assert.equal(typeof(r.get), 'function');
        assert.equal(typeof(r.post), 'function');
        assert.equal(typeof(r.patch), 'function');
        assert.equal(typeof(r.del), 'function');
    });

    it('creates a resource proxy with the right path', () => {
        let r = Z.resource('/users/me');
        assert.equal(r.getPath(), '/v1/users/me');
    });

    it('generates the correct path from components', () => {
        let r = Z.resource('users', 'me');
        assert.equal(r.getPath(), '/v1/users/me');
    });

    it('generates a resource proxy with the right path and flags', () => {
        let r = Z.resource('/organizations/sub_orgs', { recursive: true });
        assert.equal(r.getPath(), '/v1/organizations/sub_orgs?recursive');
    });

    it('generates a resource proxy with the right path and multiple flags', () => {
        let r = Z.resource('/organizations/sub_orgs', { recursive: true, foo: 'bar' });
        assert.equal(r.getPath(), '/v1/organizations/sub_orgs?recursive&foo=bar');
    });

    it('generates a resource proxy with the right path and numeric flag', () => {
        let r = Z.resource('/organizations/sub_orgs', { recursive: 2 });
        assert.equal(r.getPath(), '/v1/organizations/sub_orgs?recursive=2');
    });

    it('generates a resource proxy with the right path and properly escaped query params', () => {
        let r = Z.resource('/organizations/sub_orgs', { 'foo&bar': 'dummy%test' });
        assert.equal(r.getPath(), '/v1/organizations/sub_orgs?foo%26bar=dummy%25test');
    });

    it('throws error when passing object as wrong argument', () => {
        assert.throws(() => Z.resource({ recursive: true }, 'orgs',  1, 'sub_organizations'));
    });

    it('throws error when passing multiple objects', () => {
        assert.throws(() => Z.resource('orgs', {foo: 'bar'}, {recursive: true}));
    });
});
