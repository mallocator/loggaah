"use strict";

var moment = require('moment');
var expect = require('chai').expect;

var Level = require("..").Level;
var MDC = require("..").MDC;
var Event = require('../lib/Event.class');

describe("Message", () => {
    it("should create a message", () => {
        var mdc = new MDC();
        var error = new Error();
        var event = new Event("test/class", Level.info, "test", mdc, error);
        expect(event.level).to.be.equal(Level.info);
        expect(event.message).to.be.equal("test");
        expect(event.mdc).to.be.deep.equal(mdc);
        expect(event.error).to.be.deep.equal(error);
        expect(event.time).to.be.lte(moment());
    });
});