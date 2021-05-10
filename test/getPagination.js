'use strict';

const assert = require('assert');
const proxyquire = require('proxyquire');

const mockHttpClient = require('./helpers').mockHttpClient;


describe('get() pagination', () => {
    it('handles page argument', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path, '/v1/orgs?p=2');
                },
            }),
        });

        Z.resource('orgs')
            .get(2);
    });

    it('handles page and perPage arguments', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path, '/v1/orgs?p=2&pp=100');
                },
            }),
        });

        Z.resource('orgs')
            .get(2, 100);
    });

    it('handles page and perPage arguments with extra query params', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path, '/v1/orgs?recursive&foo=bar&p=2&pp=100');
                },
            }),
        });

        Z.resource('orgs', { recursive: true, foo: 'bar' })
            .get(2, 100);
    });
});
