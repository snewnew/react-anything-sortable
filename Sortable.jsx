/**
 * @jsx React.DOM
 * @file react-anything-sortable
 * @author jasonslyvia
 */
'use strict';

/**
 * @dependency
 */
var React = require('react/addons');
var $ = require('jquery');
var CX = React.addons.classSet;
var CloneWithProps = React.addons.cloneWithProps;

/**
 * @class Sortable
 */
var Sortable = React.createClass({
  propTypes: {
    /**
     * callback fires after each sort operation finish
     * function (dataSet){
     *   //dataSet sorted
     * }
     */
    onSort: React.PropTypes.func
  },

  getInitialState: function(){
    //keep tracking the dimension and coordinates of all children
    this._dimensionArr = this.props.children.map(function(item){
      return {}
    });
    //keep tracking the order of all children
    this._orderArr = [];
    var i = 0;
    while(i < this._dimensionArr.length){
      this._orderArr.push(i++);
    }

    return {
      isDragging: false,
      placeHolderIndex: null,
      left: null,
      top: null
    };
  },

  componentDidMount: function(){
    this.containerWidth = this.getDOMNode().offsetWidth;
  },

  componentWillUnmount: function() {
    this.unbindEvent();
  },

  bindEvent: function(){
    var self = this;
    var ns = this._eventNamespace || '.react-sortable' + Math.ceil(Math.random() * 1000);
    this._eventNamespace = ns;

    //so that the focus won't be lost if cursor moving too fast
    $(document).on('mousemove'+ns, function(e){
      self.handleMouseMove.call(self, e);
    });

    $(document).on('mouseup'+ns, function(e){
      self.handleMouseUp.call(self, e);
    });
  },

  unbindEvent: function(){
    var ns = this._eventNamespace;
    $(document).off('mousemove'+ns);
    $(document).off('mouseup'+ns);
  },

  /**
   * getting ready for dragging
   * @param  {object} e     React event
   * @param  {numbner} index index of pre-dragging item
   */
  handleMouseDown: function(e, index){
    this._draggingIndex = index;
    this._prevX = e.pageX;
    this._prevY = e.pageY;
    this._initOffset = e.offset;
    this._isReadyForDragging = true;
    this._hasInitDragging = false;

    //start listening mousemove and mouseup
    this.bindEvent();
  },

  /**
   * `add` a dragging item and re-calculating position of placeholder
   * @param  {object} e     React event
   */
  handleMouseMove: function(e){
    this._isMouseMoving = true;

    if (!this._isReadyForDragging) {
      return false;
    }

    if (!this._hasInitDragging) {
      this._dimensionArr[this._draggingIndex].isPlaceHolder = true;
      this._hasInitDragging = false;
    }

    var newOffset = this.calculateNewOffset(e);
    var newIndex = this.calculateNewIndex(e);
    this._draggingIndex = newIndex;

    this.setState({
      isDragging: true,
      top: newOffset.top,
      left: newOffset.left,
      placeHolderIndex: newIndex
    });

    this._prevX = e.pageX;
    this._prevY = e.pageY;
  },

  /**
   * replace placeholder with dragging item
   * @param  {object} e     React event
   */
  handleMouseUp: function(e){
    if (!this._isMouseMoving) {
      return;
    }
    this.unbindEvent();

    //reset temp vars
    this._draggingIndex = null;
    this._isReadyForDragging = false;
    this._isMouseMoving = false;
    this._initOffset = null;
    this._prevX = null;
    this._prevY = null;

    if (this.state.isDragging) {
      this._dimensionArr[this.state.placeHolderIndex].isPlaceHolder = false;

      //sort finished, callback fires
      if ($.isFunction(this.props.onSort)) {
        this.props.onSort(this.getSortData());
      }
    }

    this.isMounted() && this.setState({
      isDragging: false,
      placeHolderIndex: null,
      left: null,
      top: null
    });
  },

  /**
   * when children mounted, return its size(handled by SortableItemMixin)
   * @param  {object} offset {top:1, left:2}
   * @param  {number} width
   * @param  {number} height
   * @param  {number} index
   */
  handleChildUpdate: function(offset, width, height, index){
    $.extend(this._dimensionArr[index], {
      top: offset.top,
      left: offset.left,
      width: width,
      height: height
    });
  },

  /**
   * get new index of all items by cursor position
   * @param {object} offset {left: 12, top: 123}
   * @param {string} direction cursor moving direction, used to aviod blinking when
   *                 interchanging position of different width elements
   * @return {number}
   */
  getIndexByOffset: function(offset, direction){
    var self = this;
    if (!offset || !$.isNumeric(offset.top) || !$.isNumeric(offset.left)) {
      return 0;
    }

    var _dimensionArr = self._dimensionArr;
    var offsetX = offset.left;
    var offsetY = offset.top;
    var prevIndex = self.state.placeHolderIndex !== null ?
                   self.state.placeHolderIndex :
                   self._draggingIndex;
    var newIndex;

    _dimensionArr.every(function(coord, index){
      var relativeLeft = offsetX - coord.left;
      var relativeTop = offsetY - coord.top;

      if (offsetX < 0) {
        newIndex = 0;
        return false;
      }
      else if (offsetX > self.containerWidth) {
        newIndex = _dimensionArr.length - 1;
        return false;
      }
      else if (relativeLeft < coord.width && relativeTop < coord.height) {
        if (relativeLeft < coord.width / 2 && direction === 'left') {
          newIndex = index;
        }
        else if(relativeLeft > coord.width / 2 && direction === 'right'){
          newIndex = Math.min(index+1, _dimensionArr.length-1);
        }
        return false;
      }
      return true;
    });

    return newIndex !== undefined ? newIndex : prevIndex;
  },

  /**
   * untility function
   * @param  {array} arr
   * @param  {number} from
   * @param  {number} to
   * @return {array}
   */
  swapArrayItemPosition: function(arr, from, to){
    if (!arr || !$.isNumeric(from) || !$.isNumeric(to)) {
      return arr;
    }

    var fromEl = arr.splice(from, 1)[0];
    arr.splice(to, 0, fromEl);
    return arr;
  },

  /**
   * calculate new offset
   * @param  {object} e MouseMove event
   * @return {object}   {left: 1, top: 1}
   */
  calculateNewOffset: function(e){
    var self = this;

    var deltaX = self._prevX - e.pageX;
    var deltaY = self._prevY - e.pageY;

    var prevLeft = self.state.left !== null ? self.state.left : self._initOffset.left;
    var prevTop = self.state.top !== null ? self.state.top : self._initOffset.top;
    var newLeft = prevLeft - deltaX;
    var newTop = prevTop - deltaY;

    return {
      left: newLeft,
      top: newTop
    };
  },

  /**
   * calculate new index and do swapping
   * @param  {object} e MouseMove event
   * @return {number}
   */
  calculateNewIndex: function(e){
    var self = this;

    var placeHolderIndex = self.state.placeHolderIndex !== null ?
                           self.state.placeHolderIndex :
                           self._draggingIndex;
    var offset = $(e.target).closest('.ui-sortable-item').position();
    var direction = self._prevX > e.pageX ? 'left' : 'right';

    var newIndex = self.getIndexByOffset(offset, direction);
    if (newIndex !== placeHolderIndex) {
      self._dimensionArr = self.swapArrayItemPosition(self._dimensionArr, placeHolderIndex, newIndex);
      self._orderArr = self.swapArrayItemPosition(self._orderArr, placeHolderIndex, newIndex);
    }

    return newIndex;
  },

  getSortData: function(){
    var self = this;
    return self._orderArr.map(function(itemIndex, index){
      if (self._dimensionArr[index].isDeleted) {
        return;
      }
      return self.props.children[itemIndex].props.sortData;
    });
  },

  /**
   * render all sortable children which mixined with SortableItemMixin
   */
  renderItems: function(){
    var self = this;
    var _dimensionArr = self._dimensionArr;
    var _orderArr = self._orderArr;

    var draggingItem;

    var items = _orderArr.map(function(itemIndex, index){
      var item = self.props.children[itemIndex];
      if (_dimensionArr[index].isDeleted) {
        return;
      }
      if (index === self._draggingIndex) {
        draggingItem = self.renderDraggingItem(item);
      }

      var isPlaceHolder = _dimensionArr[index].isPlaceHolder;
      var itemClassName = CX({
        'ui-sortable-item': true,
        'ui-sortable-placeholder': isPlaceHolder,
        'visible': self.state.isDragging && isPlaceHolder
      });

      return CloneWithProps(item, {
        key: index,
        sortableClassName: itemClassName,
        sortableIndex: index,
        onSortableItemMouseDown: isPlaceHolder ? undefined : function(e){
          self.handleMouseDown.call(self, e, index);
        },
        onSortableItemMount: self.handleChildUpdate
      });
    });

    return items.concat([draggingItem]);
  },

  /**
   * render the item that being dragged
   * @param  {object} item a reference of this.props.children
   */
  renderDraggingItem: function(item){
    if (!item) {
      return;
    }

    var style = {
      top: this.state.top,
      left: this.state.left,
      width: this._dimensionArr[this._draggingIndex].width,
      height: this._dimensionArr[this._draggingIndex].height
    };
    return CloneWithProps(item, {
      sortableClassName: 'ui-sortable-item ui-sortable-dragging',
      key: this._dimensionArr.length,
      sortableStyle: style,
      isDragging: true
    });
  },

  render: function(){
    var className = CX({
      'ui-sortable': true
    });

    return (
      <div className={className}>
        {this.renderItems()}
      </div>
    );
  }
});

module.exports = Sortable;
