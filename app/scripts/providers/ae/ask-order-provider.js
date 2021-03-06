(function () {
'use strict';
var module = angular.module('fim.base');
module.factory('AskOrderProvider', function (nxt, $q, IndexedEntityProvider) {
  
  function AskOrderProvider(api, $scope, pageSize, asset, decimals) {
    this.init(api, $scope, pageSize);
    this.asset = asset;
    this.decimals = decimals;

    api.engine.socket().subscribe('blockPopped', angular.bind(this, this.blockPopped), $scope);
    api.engine.socket().subscribe('blockPushed', angular.bind(this, this.blockPushed), $scope);

    api.engine.socket().subscribe('ASK_ORDER_ADD*'+asset, angular.bind(this, this.orderAddUpdate), $scope);
    api.engine.socket().subscribe('ASK_ORDER_UPDATE*'+asset, angular.bind(this, this.orderAddUpdate), $scope);
    api.engine.socket().subscribe('ASK_ORDER_REMOVE*'+asset, angular.bind(this, this.orderRemove), $scope);    
  }
  angular.extend(AskOrderProvider.prototype, IndexedEntityProvider.prototype, {

    // ORDER BY price ASC, creation_height ASC, id ASC ");
    /* @override */
    sortFunction: function (a, b) {
      if (a.priceNum < b.priceNum) return -1;
      else if (a.priceNum > b.priceNum) return 1;
      else {
        if (a.height < b.height) return -1;
        else if (a.height > b.height) return 1;
        else {
          if (a.order < b.order) return -1;
          else if (a.order > b.order) return 1;
        }
      }
      return 0;
    },

    /* @override */
    uniqueKey: function (order) { return order.order },

    /* @override */
    getData: function (firstIndex) {
      var deferred = $q.defer();
      var args = {
        asset:          this.asset,
        firstIndex:     firstIndex,
        lastIndex:      firstIndex + this.pageSize,
        requestType:    'getVirtualAskOrders'
      }
      this.api.engine.socket().callAPIFunction(args).then(deferred.resolve, deferred.reject);
      return deferred.promise;
    },

    translate: function (order) {
      if (order.quantityQNT) {
        order.quantity = nxt.util.convertToQNTf(order.quantityQNT, this.decimals);
      }
      if (order.priceNQT) {
        order.price = nxt.util.calculateOrderPricePerWholeQNT(order.priceNQT, this.decimals);
        order.total = nxt.util.convertToNXT(nxt.util.calculateOrderTotalNQT(order.priceNQT, order.quantityQNT));
        order.priceNum = parseFloat(order.price.replace(',',''));
      }
    },

    /* @override */
    dataIterator: function (data) {
      var orders = data.askOrders||[];
      for (var i=0; i<orders.length; i++) {
        this.translate(orders[i]);
      }
      return new Iterator(orders);
    },

    /* @websocket */
    orderAddUpdate: function (order) {
      var self = this;
      this.$scope.$evalAsync(function () {
        self.translate(order);
        self.add(order);
      });
    },

    /* @websocket */
    orderRemove: function (order) {
      var self = this;
      this.$scope.$evalAsync(function () {
        self.remove(self.uniqueKey(order));
      });
    },

    /* @websocket */
    blockPushed: function (block) {
      var self = this;
      this.$scope.$evalAsync(function () {
        self.forEach(function (order) {
          order.confirmations = block.height - order.height;
        });
      });
    },

    /* @websocket */
    blockPopped: function (block) {
      if (this.delayedReload) {
        clearTimeout(this.delayedReload);
      }
      var self = this;
      this.delayedReload = setTimeout(function () { self.reload(); }, 1000);
    }
   
  });
  return AskOrderProvider;
});
})();