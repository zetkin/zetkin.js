'use strict';

const assert = require('assert');
const proxyquire = require('proxyquire');

const Z = require('../');
const mockHttpClient = require('./helpers').mockHttpClient;


describe('get() filters', () => {
    it('accepts null', () => {
        assert.doesNotThrow(() => {
            Z.resource('orgs')
                .get(null, null, null)
                .catch(err => {});
        });
    });

    it('accepts an array of triplets', () => {
        assert.doesNotThrow(() => {
            Z.resource('orgs')
                .get(null, null, [
                    ['param1', '==', 1],
                    ['param2', '==', 2],
                ])
                .catch(err => {});
        });
    });

    it('accepts an empty array', () => {
        assert.doesNotThrow(() => {
            Z.resource('orgs')
                .get(null, null, []);
        });
    });

    it('throws error for array of non-triplets', () => {
        assert.throws(() => {
            Z.resource('orgs')
                .get(null, null, [
                    ['param1', '=='],
                ]);
        }, /get\(\) filters should be array of triplets/);
    });

    it('throws error for non-array', () => {
        assert.throws(() => {
            Z.resource('orgs')
                .get(null, null, {});
        }, /get\(\) filters should be array of triplets/);
    });

    it('generates correct query string for single filter', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path,
                        '/v1/orgs?filter=param1%3D%3D1');
                },
            }),
        });

        Z.resource('orgs')
            .get(null, null, [
                [ 'param1', '==', 1 ],
            ]);
    });

    it('generates correct query string for single filter combined with query param', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path,
                        '/v1/orgs?foo=bar&filter=param1%3D%3D1');
                },
            }),
        });

        Z.resource('orgs', { foo: 'bar' })
            .get(null, null, [
                [ 'param1', '==', 1 ],
            ]);
    });

    it('generates correct query string for two filters', done => {
        let Z = proxyquire('../', {
            https: mockHttpClient({
                done: done,
                validateRequestOptions: opts => {
                    assert.equal(opts.path,
                        '/v1/orgs?filter=param1%3D%3D1&filter=param2%3D%3D2');
                },
            }),
        });

        Z.resource('orgs')
            .get(null, null, [
                [ 'param1', '==', 1 ],
                [ 'param2', '==', 2 ],
            ]);
    });
});
