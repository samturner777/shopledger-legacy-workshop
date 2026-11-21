'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderFor(item, coupon, totals) {
  return {
    id: 1,
    date: '21/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [item],
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice GST breakdown and total match the billed pricing totals', function () {
  var item = { id: 10, name: 'Rice', sku: 'RICE-10', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, '', billed));

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.tax);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice applies the same HSN slab used for billed pricing', function () {
  var item = { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, '', billed));

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice uses billed coupon discount and post-discount GST totals', function () {
  var item = { id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 200, qty: 1 };
  var billed = pricing.computeTotals([item], 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, 'WELCOME', billed));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 200, discount: 10, tax: 9.5, total: 199.5 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice does not discount a coupon that pricing marks expired', function () {
  var item = { id: 3, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], 'DIWALI20');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, 'DIWALI20', billed));

  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.total, billed.total);
});

test('reconciliation reports matching invoice and ledger totals and GST', function () {
  var item = { id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], '');
  var order = orderFor(item, '', billed);
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].matched, true);
});
