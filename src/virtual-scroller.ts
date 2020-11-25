import {
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgModule,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  Renderer2,
  ViewChild,
} from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

import { CommonModule } from '@angular/common';

import * as tween from '@tweenjs/tween.js';

export interface VirtualScrollerDefaultOptions {
  checkResizeInterval: number;
  modifyOverflowStyleOfParentScroll: boolean;
  resizeBypassRefreshThreshold: number;
  scrollAnimationTime: number;
  scrollDebounceTime: number;
  scrollThrottlingTime: number;
  scrollbarHeight?: number;
  scrollbarWidth?: number;
  stripedTable: boolean;
}

export function VIRTUAL_SCROLLER_DEFAULT_OPTIONS_FACTORY(): VirtualScrollerDefaultOptions {
  return {
    checkResizeInterval: 1000,
    modifyOverflowStyleOfParentScroll: true,
    resizeBypassRefreshThreshold: 5,
    scrollAnimationTime: 750,
    scrollDebounceTime: 0,
    scrollThrottlingTime: 0,
    stripedTable: false,
  };
}

export interface WrapGroupDimensions {
  maxChildSizePerWrapGroup: WrapGroupDimension[];
  numberOfKnownWrapGroupChildSizes: number;
  sumOfKnownWrapGroupChildHeights: number;
  sumOfKnownWrapGroupChildWidths: number;
}

export interface WrapGroupDimension {
  childHeight: number;
  childWidth: number;
  items: any[];
}

export interface IDimensions {
  childHeight: number;
  childWidth: number;
  itemCount: number;
  itemsPerPage: number;
  itemsPerWrapGroup: number;
  maxScrollPosition: number;
  pageCount_fractional: number;
  scrollLength: number;
  viewportLength: number;
  wrapGroupsPerPage: number;
}

export interface IPageInfo {
  endIndex: number;
  endIndexWithBuffer: number;
  maxScrollPosition: number;
  scrollEndPosition: number;
  scrollStartPosition: number;
  startIndex: number;
  startIndexWithBuffer: number;
}

export interface IViewport extends IPageInfo {
  padding: number;
  scrollLength: number;
}

@Component({
  selector: 'virtual-scroller,[virtualScroller]',
  exportAs: 'virtualScroller',
  template: `
    <div class="total-padding" #invisiblePadding></div>
    <div class="scrollable-content" #content>
      <ng-content></ng-content>
    </div>
  `,
  host: {
    '[class.horizontal]': 'horizontal',
    '[class.vertical]': '!horizontal',
    '[class.selfScroll]': '!parentScroll',
    '[class.rtl]': 'RTL',
  },
  styles: [
    `
      :host {
        position: relative;
        display: block;
        -webkit-overflow-scrolling: touch;
      }

      :host.horizontal.selfScroll {
        overflow-y: visible;
        overflow-x: auto;
      }

      :host.horizontal.selfScroll.rtl {
        transform: scaleX(-1);
      }

      :host.vertical.selfScroll {
        overflow-y: auto;
        overflow-x: visible;
      }

      .scrollable-content {
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        max-width: 100vw;
        max-height: 100vh;
        position: absolute;
      }

      .scrollable-content ::ng-deep > * {
        box-sizing: border-box;
      }

      :host.horizontal {
        white-space: nowrap;
      }

      :host.horizontal .scrollable-content {
        display: flex;
      }

      :host.horizontal .scrollable-content ::ng-deep > * {
        flex-shrink: 0;
        flex-grow: 0;
        white-space: initial;
      }

      :host.horizontal.rtl .scrollable-content ::ng-deep > * {
        transform: scaleX(-1);
      }

      .total-padding {
        position: absolute;
        top: 0;
        left: 0;
        height: 1px;
        width: 1px;
        transform-origin: 0 0;
        opacity: 0;
      }

      :host.horizontal .total-padding {
        height: 100%;
      }
    `,
  ],
})
export class VirtualScrollerComponent implements OnInit, OnChanges, OnDestroy {
  public get viewPortInfo(): IPageInfo {
    const pageInfo: IViewport = this.previousViewPort || ({} as any);
    return {
      startIndex: pageInfo.startIndex || 0,
      endIndex: pageInfo.endIndex || 0,
      scrollStartPosition: pageInfo.scrollStartPosition || 0,
      scrollEndPosition: pageInfo.scrollEndPosition || 0,
      maxScrollPosition: pageInfo.maxScrollPosition || 0,
      startIndexWithBuffer: pageInfo.startIndexWithBuffer || 0,
      endIndexWithBuffer: pageInfo.endIndexWithBuffer || 0,
    };
  }
  @Input()
  public get enableUnequalChildrenSizes(): boolean {
    return this._enableUnequalChildrenSizes;
  }
  public set enableUnequalChildrenSizes(value: boolean) {
    if (this._enableUnequalChildrenSizes === value) {
      return;
    }

    this._enableUnequalChildrenSizes = value;
    this.minMeasuredChildWidth = undefined;
    this.minMeasuredChildHeight = undefined;
  }
  @Input()
  public get bufferAmount(): number {
    if (typeof this._bufferAmount === 'number' && this._bufferAmount >= 0) {
      return this._bufferAmount;
    } else {
      return this.enableUnequalChildrenSizes ? 5 : 0;
    }
  }
  public set bufferAmount(value: number) {
    this._bufferAmount = value;
  }
  @Input()
  public get scrollThrottlingTime(): number {
    return this._scrollThrottlingTime;
  }
  public set scrollThrottlingTime(value: number) {
    this._scrollThrottlingTime = value;
    this.updateOnScrollFunction();
  }
  @Input()
  public get scrollDebounceTime(): number {
    return this._scrollDebounceTime;
  }
  public set scrollDebounceTime(value: number) {
    this._scrollDebounceTime = value;
    this.updateOnScrollFunction();
  }
  @Input()
  public get checkResizeInterval(): number {
    return this._checkResizeInterval;
  }
  public set checkResizeInterval(value: number) {
    if (this._checkResizeInterval === value) {
      return;
    }

    this._checkResizeInterval = value;
    this.addScrollEventHandlers();
  }
  @Input()
  public get items(): any[] {
    return this._items;
  }
  public set items(value: any[]) {
    if (value === this._items) {
      return;
    }

    this._items = value || [];
    this.refresh_internal(true);
  }
  @Input()
  public get horizontal(): boolean {
    return this._horizontal;
  }
  public set horizontal(value: boolean) {
    this._horizontal = value;
    this.updateDirection();
  }
  @Input()
  public get parentScroll(): Element | Window {
    return this._parentScroll;
  }
  public set parentScroll(value: Element | Window) {
    if (this._parentScroll === value) {
      return;
    }

    this.revertParentOverscroll();
    this._parentScroll = value;
    this.addScrollEventHandlers();

    const scrollElement = this.getScrollElement();
    if (
      this.modifyOverflowStyleOfParentScroll &&
      scrollElement !== this.element.nativeElement
    ) {
      this.oldParentScrollOverflow = {
        x: scrollElement.style['overflow-x'],
        y: scrollElement.style['overflow-y'],
      };
      scrollElement.style['overflow-y'] = this.horizontal ? 'visible' : 'auto';
      scrollElement.style['overflow-x'] = this.horizontal ? 'auto' : 'visible';
    }
  }

  constructor(
    protected readonly element: ElementRef,
    protected readonly renderer: Renderer2,
    protected readonly zone: NgZone,
    protected changeDetectorRef: ChangeDetectorRef,
    // tslint:disable-next-line: ban-types
    @Inject(PLATFORM_ID) platformId: Object,
    @Optional()
    @Inject('virtual-scroller-default-options')
    options: VirtualScrollerDefaultOptions
  ) {
    this.isAngularUniversalSSR = isPlatformServer(platformId);

    this.checkResizeInterval = options.checkResizeInterval;
    this.modifyOverflowStyleOfParentScroll =
      options.modifyOverflowStyleOfParentScroll;
    this.resizeBypassRefreshThreshold = options.resizeBypassRefreshThreshold;
    this.scrollAnimationTime = options.scrollAnimationTime;
    this.scrollDebounceTime = options.scrollDebounceTime;
    this.scrollThrottlingTime = options.scrollThrottlingTime;
    this.scrollbarHeight = options.scrollbarHeight;
    this.scrollbarWidth = options.scrollbarWidth;
    this.stripedTable = options.stripedTable;

    this.horizontal = false;
    this.resetWrapGroupDimensions();
  }
  public viewPortItems: any[];
  public window = window;

  @Input()
  public executeRefreshOutsideAngularZone = false;

  protected _enableUnequalChildrenSizes = false;

  @Input()
  public RTL = false;

  @Input()
  public useMarginInsteadOfTranslate = false;

  @Input()
  public modifyOverflowStyleOfParentScroll: boolean;

  @Input()
  public stripedTable: boolean;

  @Input()
  public scrollbarWidth: number;

  @Input()
  public scrollbarHeight: number;

  @Input()
  public childWidth: number;

  @Input()
  public childHeight: number;

  @Input()
  public ssrChildWidth: number;

  @Input()
  public ssrChildHeight: number;

  @Input()
  public ssrViewportWidth = 1920;

  @Input()
  public ssrViewportHeight = 1080;

  protected _bufferAmount: number;

  @Input()
  public scrollAnimationTime: number;

  @Input()
  public resizeBypassRefreshThreshold: number;

  protected _scrollThrottlingTime: number;

  protected _scrollDebounceTime: number;

  protected onScroll: () => void;

  protected checkScrollElementResizedTimer: number;
  protected _checkResizeInterval: number;

  protected _items: any[] = [];

  protected _horizontal: boolean;

  protected oldParentScrollOverflow: { x: string; y: string };
  protected _parentScroll: Element | Window;

  @Output()
  public vsUpdate: EventEmitter<any[]> = new EventEmitter<any[]>();

  @Output()
  public vsChange: EventEmitter<IPageInfo> = new EventEmitter<IPageInfo>();

  @Output()
  public vsStart: EventEmitter<IPageInfo> = new EventEmitter<IPageInfo>();

  @Output()
  public vsEnd: EventEmitter<IPageInfo> = new EventEmitter<IPageInfo>();

  @ViewChild('content', { read: ElementRef, static: true })
  protected contentElementRef: ElementRef;

  @ViewChild('invisiblePadding', { read: ElementRef, static: true })
  protected invisiblePaddingElementRef: ElementRef;

  @ContentChild('header', { read: ElementRef, static: false })
  protected headerElementRef: ElementRef;

  @ContentChild('container', { read: ElementRef, static: false })
  protected containerElementRef: ElementRef;

  protected isAngularUniversalSSR: boolean;

  protected previousScrollBoundingRect: ClientRect;

  protected _invisiblePaddingProperty;
  protected _offsetType;
  protected _scrollType;
  protected _pageOffsetType;
  protected _childScrollDim;
  protected _translateDir;
  protected _marginDir;

  protected calculatedScrollbarWidth = 0;
  protected calculatedScrollbarHeight = 0;

  protected padding = 0;
  protected previousViewPort: IViewport = {} as any;
  protected currentTween: tween.Tween;
  protected cachedItemsLength: number;

  protected disposeScrollHandler: () => void | undefined;
  protected disposeResizeHandler: () => void | undefined;

  protected minMeasuredChildWidth: number;
  protected minMeasuredChildHeight: number;

  protected wrapGroupDimensions: WrapGroupDimensions;

  protected cachedPageSize = 0;
  protected previousScrollNumberElements = 0;
  protected updateOnScrollFunction(): void {
    if (this.scrollDebounceTime) {
      this.onScroll = this.debounce(() => {
        this.refresh_internal(false);
      }, this.scrollDebounceTime) as any;
    } else if (this.scrollThrottlingTime) {
      this.onScroll = this.throttleTrailing(() => {
        this.refresh_internal(false);
      }, this.scrollThrottlingTime) as any;
    } else {
      this.onScroll = () => {
        this.refresh_internal(false);
      };
    }
  }

  @Input()
  public compareItems: (item1: any, item2: any) => boolean = (
    item1: any,
    item2: any
  ) => item1 === item2;

  protected revertParentOverscroll(): void {
    const scrollElement = this.getScrollElement();
    if (scrollElement && this.oldParentScrollOverflow) {
      scrollElement.style['overflow-y'] = this.oldParentScrollOverflow.y;
      scrollElement.style['overflow-x'] = this.oldParentScrollOverflow.x;
    }

    this.oldParentScrollOverflow = undefined;
  }

  public ngOnInit(): void {
    this.addScrollEventHandlers();
  }

  public ngOnDestroy(): void {
    this.removeScrollEventHandlers();
    this.revertParentOverscroll();
  }

  public ngOnChanges(changes: any): void {
    const indexLengthChanged = this.cachedItemsLength !== this.items.length;
    this.cachedItemsLength = this.items.length;

    const firstRun: boolean =
      !changes.items ||
      !changes.items.previousValue ||
      changes.items.previousValue.length === 0;
    this.refresh_internal(indexLengthChanged || firstRun);
  }

  public ngDoCheck(): void {
    if (this.cachedItemsLength !== this.items.length) {
      this.cachedItemsLength = this.items.length;
      this.refresh_internal(true);
      return;
    }

    if (
      this.previousViewPort &&
      this.viewPortItems &&
      this.viewPortItems.length > 0
    ) {
      let itemsArrayChanged = false;
      for (let i = 0; i < this.viewPortItems.length; ++i) {
        if (
          !this.compareItems(
            this.items[this.previousViewPort.startIndexWithBuffer + i],
            this.viewPortItems[i]
          )
        ) {
          itemsArrayChanged = true;
          break;
        }
      }
      if (itemsArrayChanged) {
        this.refresh_internal(true);
      }
    }
  }

  public refresh(): void {
    this.refresh_internal(true);
  }

  public invalidateAllCachedMeasurements(): void {
    this.wrapGroupDimensions = {
      maxChildSizePerWrapGroup: [],
      numberOfKnownWrapGroupChildSizes: 0,
      sumOfKnownWrapGroupChildWidths: 0,
      sumOfKnownWrapGroupChildHeights: 0,
    };

    this.minMeasuredChildWidth = undefined;
    this.minMeasuredChildHeight = undefined;

    this.refresh_internal(false);
  }

  public invalidateCachedMeasurementForItem(item: any): void {
    if (this.enableUnequalChildrenSizes) {
      const index = this.items && this.items.indexOf(item);
      if (index >= 0) {
        this.invalidateCachedMeasurementAtIndex(index);
      }
    } else {
      this.minMeasuredChildWidth = undefined;
      this.minMeasuredChildHeight = undefined;
    }

    this.refresh_internal(false);
  }

  public invalidateCachedMeasurementAtIndex(index: number): void {
    if (this.enableUnequalChildrenSizes) {
      const cachedMeasurement = this.wrapGroupDimensions
        .maxChildSizePerWrapGroup[index];
      if (cachedMeasurement) {
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[index] = undefined;
        --this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths -=
          cachedMeasurement.childWidth || 0;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights -=
          cachedMeasurement.childHeight || 0;
      }
    } else {
      this.minMeasuredChildWidth = undefined;
      this.minMeasuredChildHeight = undefined;
    }

    this.refresh_internal(false);
  }

  public scrollInto(
    item: any,
    alignToBeginning: boolean = true,
    additionalOffset: number = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void
  ): void {
    const index: number = this.items.indexOf(item);
    if (index === -1) {
      return;
    }

    this.scrollToIndex(
      index,
      alignToBeginning,
      additionalOffset,
      animationMilliseconds,
      animationCompletedCallback
    );
  }

  public scrollToIndex(
    index: number,
    alignToBeginning: boolean = true,
    additionalOffset: number = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void
  ): void {
    let maxRetries = 5;

    const retryIfNeeded = () => {
      --maxRetries;
      if (maxRetries <= 0) {
        if (animationCompletedCallback) {
          animationCompletedCallback();
        }
        return;
      }

      const dimensions = this.calculateDimensions();
      const desiredStartIndex = Math.min(
        Math.max(index, 0),
        dimensions.itemCount - 1
      );
      if (this.previousViewPort.startIndex === desiredStartIndex) {
        if (animationCompletedCallback) {
          animationCompletedCallback();
        }
        return;
      }

      this.scrollToIndex_internal(
        index,
        alignToBeginning,
        additionalOffset,
        0,
        retryIfNeeded
      );
    };

    this.scrollToIndex_internal(
      index,
      alignToBeginning,
      additionalOffset,
      animationMilliseconds,
      retryIfNeeded
    );
  }

  protected scrollToIndex_internal(
    index: number,
    alignToBeginning: boolean = true,
    additionalOffset: number = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void
  ): void {
    animationMilliseconds =
      animationMilliseconds === undefined
        ? this.scrollAnimationTime
        : animationMilliseconds;

    const dimensions = this.calculateDimensions();
    let scroll = this.calculatePadding(index, dimensions) + additionalOffset;
    if (!alignToBeginning) {
      scroll -= dimensions.wrapGroupsPerPage * dimensions[this._childScrollDim];
    }

    this.scrollToPosition(
      scroll,
      animationMilliseconds,
      animationCompletedCallback
    );
  }

  public scrollToPosition(
    scrollPosition: number,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void
  ): void {
    scrollPosition += this.getElementsOffset();

    animationMilliseconds =
      animationMilliseconds === undefined
        ? this.scrollAnimationTime
        : animationMilliseconds;

    const scrollElement = this.getScrollElement();

    let animationRequest: number;

    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = undefined;
    }

    if (!animationMilliseconds) {
      this.renderer.setProperty(
        scrollElement,
        this._scrollType,
        scrollPosition
      );
      this.refresh_internal(false, animationCompletedCallback);
      return;
    }

    const tweenConfigObj = { scrollPosition: scrollElement[this._scrollType] };

    const newTween = new tween.Tween(tweenConfigObj)
      .to({ scrollPosition }, animationMilliseconds)
      .easing(tween.Easing.Quadratic.Out)
      .onUpdate((data) => {
        if (isNaN(data.scrollPosition)) {
          return;
        }
        this.renderer.setProperty(
          scrollElement,
          this._scrollType,
          data.scrollPosition
        );
        this.refresh_internal(false);
      })
      .onStop(() => {
        cancelAnimationFrame(animationRequest);
      })
      .start();

    const animate = (time?: number) => {
      if (!newTween.isPlaying()) {
        return;
      }

      newTween.update(time);
      if (tweenConfigObj.scrollPosition === scrollPosition) {
        this.refresh_internal(false, animationCompletedCallback);
        return;
      }

      this.zone.runOutsideAngular(() => {
        animationRequest = requestAnimationFrame(animate);
      });
    };

    animate();
    this.currentTween = newTween;
  }

  protected getElementSize(element: HTMLElement): ClientRect {
    const result = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const marginTop = parseInt(styles['margin-top'], 10) || 0;
    const marginBottom = parseInt(styles['margin-bottom'], 10) || 0;
    const marginLeft = parseInt(styles['margin-left'], 10) || 0;
    const marginRight = parseInt(styles['margin-right'], 10) || 0;

    return {
      top: result.top + marginTop,
      bottom: result.bottom + marginBottom,
      left: result.left + marginLeft,
      right: result.right + marginRight,
      width: result.width + marginLeft + marginRight,
      height: result.height + marginTop + marginBottom,
    };
  }
  protected checkScrollElementResized(): void {
    const boundingRect = this.getElementSize(this.getScrollElement());

    let sizeChanged: boolean;
    if (!this.previousScrollBoundingRect) {
      sizeChanged = true;
    } else {
      const widthChange = Math.abs(
        boundingRect.width - this.previousScrollBoundingRect.width
      );
      const heightChange = Math.abs(
        boundingRect.height - this.previousScrollBoundingRect.height
      );
      sizeChanged =
        widthChange > this.resizeBypassRefreshThreshold ||
        heightChange > this.resizeBypassRefreshThreshold;
    }

    if (sizeChanged) {
      this.previousScrollBoundingRect = boundingRect;
      if (boundingRect.width > 0 && boundingRect.height > 0) {
        this.refresh_internal(false);
      }
    }
  }
  protected updateDirection(): void {
    if (this.horizontal) {
      this._childScrollDim = 'childWidth';
      this._invisiblePaddingProperty = 'scaleX';
      this._marginDir = 'margin-left';
      this._offsetType = 'offsetLeft';
      this._pageOffsetType = 'pageXOffset';
      this._scrollType = 'scrollLeft';
      this._translateDir = 'translateX';
    } else {
      this._childScrollDim = 'childHeight';
      this._invisiblePaddingProperty = 'scaleY';
      this._marginDir = 'margin-top';
      this._offsetType = 'offsetTop';
      this._pageOffsetType = 'pageYOffset';
      this._scrollType = 'scrollTop';
      this._translateDir = 'translateY';
    }
  }

  protected debounce(
    func: () => void,
    wait: number
  ): { (): void; cancel: () => void } {
    const throttled = this.throttleTrailing(func, wait);
    const result = function () {
      throttled.cancel();
      throttled.apply(this, arguments);
    };
    result.cancel = () => {
      throttled.cancel();
    };

    return result;
  }

  protected throttleTrailing(
    func: () => void,
    wait: number
  ): { (): void; cancel: () => void } {
    let timeout;
    let _arguments = arguments;
    const result = function () {
      const _this = this;
      _arguments = arguments;

      if (timeout) {
        return;
      }

      if (wait <= 0) {
        func.apply(_this, _arguments);
      } else {
        timeout = setTimeout(() => {
          timeout = undefined;
          func.apply(_this, _arguments);
        }, wait);
      }
    };
    result.cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };

    return result;
  }

  protected refresh_internal(
    itemsArrayModified: boolean,
    refreshCompletedCallback?: () => void,
    maxRunTimes: number = 2
  ): void {
    // note: maxRunTimes is to force it to keep recalculating if the previous iteration caused a re-render
    // (different sliced items in viewport or scrollPosition changed).
    // The default of 2x max will probably be accurate enough without causing too large a performance bottleneck
    // The code would typically quit out on the 2nd iteration anyways. The main time it'd think more than 2 runs
    // would be necessary would be for vastly different sized child items or if this is the 1st time the items array was initialized.
    // Without maxRunTimes, If the user is actively scrolling this code would become an infinite loop until they stopped scrolling.
    // This would be okay, except each scroll event would start an additional infinte loop. We want to short-circuit it to prevent this.

    if (
      itemsArrayModified &&
      this.previousViewPort &&
      this.previousViewPort.scrollStartPosition > 0
    ) {
      // if items were prepended, scroll forward to keep same items visible
      const oldViewPort = this.previousViewPort;
      const oldViewPortItems = this.viewPortItems;

      const oldRefreshCompletedCallback = refreshCompletedCallback;
      refreshCompletedCallback = () => {
        const scrollLengthDelta =
          this.previousViewPort.scrollLength - oldViewPort.scrollLength;
        if (scrollLengthDelta > 0 && this.viewPortItems) {
          const oldStartItem = oldViewPortItems[0];
          const oldStartItemIndex = this.items.findIndex((x) =>
            this.compareItems(oldStartItem, x)
          );
          if (oldStartItemIndex > this.previousViewPort.startIndexWithBuffer) {
            let itemOrderChanged = false;
            for (let i = 1; i < this.viewPortItems.length; ++i) {
              if (
                !this.compareItems(
                  this.items[oldStartItemIndex + i],
                  oldViewPortItems[i]
                )
              ) {
                itemOrderChanged = true;
                break;
              }
            }

            if (!itemOrderChanged) {
              this.scrollToPosition(
                this.previousViewPort.scrollStartPosition + scrollLengthDelta,
                0,
                oldRefreshCompletedCallback
              );
              return;
            }
          }
        }

        if (oldRefreshCompletedCallback) {
          oldRefreshCompletedCallback();
        }
      };
    }

    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (itemsArrayModified) {
          this.resetWrapGroupDimensions();
        }
        const viewport = this.calculateViewport();

        const startChanged =
          itemsArrayModified ||
          viewport.startIndex !== this.previousViewPort.startIndex;
        const endChanged =
          itemsArrayModified ||
          viewport.endIndex !== this.previousViewPort.endIndex;
        const scrollLengthChanged =
          viewport.scrollLength !== this.previousViewPort.scrollLength;
        const paddingChanged =
          viewport.padding !== this.previousViewPort.padding;
        const scrollPositionChanged =
          viewport.scrollStartPosition !==
            this.previousViewPort.scrollStartPosition ||
          viewport.scrollEndPosition !==
            this.previousViewPort.scrollEndPosition ||
          viewport.maxScrollPosition !==
            this.previousViewPort.maxScrollPosition;

        this.previousViewPort = viewport;

        if (scrollLengthChanged) {
          this.renderer.setStyle(
            this.invisiblePaddingElementRef.nativeElement,
            'transform',
            `${this._invisiblePaddingProperty}(${viewport.scrollLength})`
          );
          this.renderer.setStyle(
            this.invisiblePaddingElementRef.nativeElement,
            'webkitTransform',
            `${this._invisiblePaddingProperty}(${viewport.scrollLength})`
          );
        }

        if (paddingChanged) {
          if (this.useMarginInsteadOfTranslate) {
            this.renderer.setStyle(
              this.contentElementRef.nativeElement,
              this._marginDir,
              `${viewport.padding}px`
            );
          } else {
            this.renderer.setStyle(
              this.contentElementRef.nativeElement,
              'transform',
              `${this._translateDir}(${viewport.padding}px)`
            );
            this.renderer.setStyle(
              this.contentElementRef.nativeElement,
              'webkitTransform',
              `${this._translateDir}(${viewport.padding}px)`
            );
          }
        }

        if (this.headerElementRef) {
          const scrollPosition = this.getScrollElement()[this._scrollType];
          const containerOffset = this.getElementsOffset();
          const offset = Math.max(
            scrollPosition -
              viewport.padding -
              containerOffset +
              this.headerElementRef.nativeElement.clientHeight,
            0
          );
          this.renderer.setStyle(
            this.headerElementRef.nativeElement,
            'transform',
            `${this._translateDir}(${offset}px)`
          );
          this.renderer.setStyle(
            this.headerElementRef.nativeElement,
            'webkitTransform',
            `${this._translateDir}(${offset}px)`
          );
        }

        const changeEventArg: IPageInfo =
          startChanged || endChanged
            ? {
                startIndex: viewport.startIndex,
                endIndex: viewport.endIndex,
                scrollStartPosition: viewport.scrollStartPosition,
                scrollEndPosition: viewport.scrollEndPosition,
                startIndexWithBuffer: viewport.startIndexWithBuffer,
                endIndexWithBuffer: viewport.endIndexWithBuffer,
                maxScrollPosition: viewport.maxScrollPosition,
              }
            : undefined;

        if (startChanged || endChanged || scrollPositionChanged) {
          const handleChanged = () => {
            // update the scroll list to trigger re-render of components in viewport
            this.viewPortItems =
              viewport.startIndexWithBuffer >= 0 &&
              viewport.endIndexWithBuffer >= 0
                ? this.items.slice(
                    viewport.startIndexWithBuffer,
                    viewport.endIndexWithBuffer + 1
                  )
                : [];
            this.vsUpdate.emit(this.viewPortItems);

            if (startChanged) {
              this.vsStart.emit(changeEventArg);
            }

            if (endChanged) {
              this.vsEnd.emit(changeEventArg);
            }

            if (startChanged || endChanged) {
              this.changeDetectorRef.markForCheck();
              this.vsChange.emit(changeEventArg);
            }

            if (maxRunTimes > 0) {
              this.refresh_internal(
                false,
                refreshCompletedCallback,
                maxRunTimes - 1
              );
              return;
            }

            if (refreshCompletedCallback) {
              refreshCompletedCallback();
            }
          };

          if (this.executeRefreshOutsideAngularZone) {
            handleChanged();
          } else {
            this.zone.run(handleChanged);
          }
        } else {
          if (maxRunTimes > 0 && (scrollLengthChanged || paddingChanged)) {
            this.refresh_internal(
              false,
              refreshCompletedCallback,
              maxRunTimes - 1
            );
            return;
          }

          if (refreshCompletedCallback) {
            refreshCompletedCallback();
          }
        }
      });
    });
  }

  protected getScrollElement(): HTMLElement {
    return this.parentScroll instanceof Window
      ? document.scrollingElement || document.documentElement || document.body
      : this.parentScroll || this.element.nativeElement;
  }

  protected addScrollEventHandlers(): void {
    if (this.isAngularUniversalSSR) {
      return;
    }

    const scrollElement = this.getScrollElement();

    this.removeScrollEventHandlers();

    this.zone.runOutsideAngular(() => {
      if (this.parentScroll instanceof Window) {
        this.disposeScrollHandler = this.renderer.listen(
          'window',
          'scroll',
          this.onScroll
        );
        this.disposeResizeHandler = this.renderer.listen(
          'window',
          'resize',
          this.onScroll
        );
      } else {
        this.disposeScrollHandler = this.renderer.listen(
          scrollElement,
          'scroll',
          this.onScroll
        );
        if (this._checkResizeInterval > 0) {
          this.checkScrollElementResizedTimer = setInterval(() => {
            this.checkScrollElementResized();
          }, this._checkResizeInterval) as any;
        }
      }
    });
  }

  protected removeScrollEventHandlers(): void {
    if (this.checkScrollElementResizedTimer) {
      clearInterval(this.checkScrollElementResizedTimer);
    }

    if (this.disposeScrollHandler) {
      this.disposeScrollHandler();
      this.disposeScrollHandler = undefined;
    }

    if (this.disposeResizeHandler) {
      this.disposeResizeHandler();
      this.disposeResizeHandler = undefined;
    }
  }

  protected getElementsOffset(): number {
    if (this.isAngularUniversalSSR) {
      return 0;
    }

    let offset = 0;

    if (this.containerElementRef && this.containerElementRef.nativeElement) {
      offset += this.containerElementRef.nativeElement[this._offsetType];
    }

    if (this.parentScroll) {
      const scrollElement = this.getScrollElement();
      const elementClientRect = this.getElementSize(this.element.nativeElement);
      const scrollClientRect = this.getElementSize(scrollElement);
      if (this.horizontal) {
        offset += elementClientRect.left - scrollClientRect.left;
      } else {
        offset += elementClientRect.top - scrollClientRect.top;
      }

      if (!(this.parentScroll instanceof Window)) {
        offset += scrollElement[this._scrollType];
      }
    }

    return offset;
  }

  protected countItemsPerWrapGroup(): number {
    if (this.isAngularUniversalSSR) {
      return Math.round(
        this.horizontal
          ? this.ssrViewportHeight / this.ssrChildHeight
          : this.ssrViewportWidth / this.ssrChildWidth
      );
    }

    const propertyName = this.horizontal ? 'offsetLeft' : 'offsetTop';
    const children = (
      (this.containerElementRef && this.containerElementRef.nativeElement) ||
      this.contentElementRef.nativeElement
    ).children;

    const childrenLength = children ? children.length : 0;
    if (childrenLength === 0) {
      return 1;
    }

    const firstOffset = children[0][propertyName];
    let result = 1;
    while (
      result < childrenLength &&
      firstOffset === children[result][propertyName]
    ) {
      ++result;
    }

    return result;
  }

  protected getScrollStartPosition(): number {
    let windowScrollValue;
    if (this.parentScroll instanceof Window) {
      windowScrollValue = window[this._pageOffsetType];
    }

    return windowScrollValue || this.getScrollElement()[this._scrollType] || 0;
  }

  protected resetWrapGroupDimensions(): void {
    const oldWrapGroupDimensions = this.wrapGroupDimensions;
    this.invalidateAllCachedMeasurements();

    if (
      !this.enableUnequalChildrenSizes ||
      !oldWrapGroupDimensions ||
      oldWrapGroupDimensions.numberOfKnownWrapGroupChildSizes === 0
    ) {
      return;
    }

    const itemsPerWrapGroup: number = this.countItemsPerWrapGroup();
    for (
      let wrapGroupIndex = 0;
      wrapGroupIndex < oldWrapGroupDimensions.maxChildSizePerWrapGroup.length;
      ++wrapGroupIndex
    ) {
      const oldWrapGroupDimension: WrapGroupDimension =
        oldWrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex];
      if (
        !oldWrapGroupDimension ||
        !oldWrapGroupDimension.items ||
        !oldWrapGroupDimension.items.length
      ) {
        continue;
      }

      if (oldWrapGroupDimension.items.length !== itemsPerWrapGroup) {
        return;
      }

      let itemsChanged = false;
      const arrayStartIndex = itemsPerWrapGroup * wrapGroupIndex;
      for (let i = 0; i < itemsPerWrapGroup; ++i) {
        if (
          !this.compareItems(
            oldWrapGroupDimension.items[i],
            this.items[arrayStartIndex + i]
          )
        ) {
          itemsChanged = true;
          break;
        }
      }

      if (!itemsChanged) {
        ++this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths +=
          oldWrapGroupDimension.childWidth || 0;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights +=
          oldWrapGroupDimension.childHeight || 0;
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[
          wrapGroupIndex
        ] = oldWrapGroupDimension;
      }
    }
  }

  protected calculateDimensions(): IDimensions {
    const scrollElement = this.getScrollElement();
    // Note: Formula to auto-calculate doesn't work for ParentScroll, so we default to this if not set by consuming application
    const maxCalculatedScrollBarSize = 25;
    this.calculatedScrollbarHeight = Math.max(
      Math.min(
        scrollElement.offsetHeight - scrollElement.clientHeight,
        maxCalculatedScrollBarSize
      ),
      this.calculatedScrollbarHeight
    );
    this.calculatedScrollbarWidth = Math.max(
      Math.min(
        scrollElement.offsetWidth - scrollElement.clientWidth,
        maxCalculatedScrollBarSize
      ),
      this.calculatedScrollbarWidth
    );

    let viewportWidth =
      scrollElement.offsetWidth -
      (this.scrollbarWidth ||
        this.calculatedScrollbarWidth ||
        (this.horizontal ? 0 : maxCalculatedScrollBarSize));
    let viewportHeight =
      scrollElement.offsetHeight -
      (this.scrollbarHeight ||
        this.calculatedScrollbarHeight ||
        (this.horizontal ? maxCalculatedScrollBarSize : 0));

    const content =
      (this.containerElementRef && this.containerElementRef.nativeElement) ||
      this.contentElementRef.nativeElement;

    const itemsPerWrapGroup = this.countItemsPerWrapGroup();
    let wrapGroupsPerPage;

    let defaultChildWidth;
    let defaultChildHeight;

    if (this.isAngularUniversalSSR) {
      viewportWidth = this.ssrViewportWidth;
      viewportHeight = this.ssrViewportHeight;
      defaultChildWidth = this.ssrChildWidth;
      defaultChildHeight = this.ssrChildHeight;
      const itemsPerRow = Math.max(
        Math.ceil(viewportWidth / defaultChildWidth),
        1
      );
      const itemsPerCol = Math.max(
        Math.ceil(viewportHeight / defaultChildHeight),
        1
      );
      wrapGroupsPerPage = this.horizontal ? itemsPerRow : itemsPerCol;
    } else if (!this.enableUnequalChildrenSizes) {
      if (content.children.length > 0) {
        if (!this.childWidth || !this.childHeight) {
          if (!this.minMeasuredChildWidth && viewportWidth > 0) {
            this.minMeasuredChildWidth = viewportWidth;
          }
          if (!this.minMeasuredChildHeight && viewportHeight > 0) {
            this.minMeasuredChildHeight = viewportHeight;
          }
        }

        const child = content.children[0];
        const clientRect = this.getElementSize(child);
        this.minMeasuredChildWidth = Math.min(
          this.minMeasuredChildWidth,
          clientRect.width
        );
        this.minMeasuredChildHeight = Math.min(
          this.minMeasuredChildHeight,
          clientRect.height
        );
      }

      defaultChildWidth =
        this.childWidth || this.minMeasuredChildWidth || viewportWidth;
      defaultChildHeight =
        this.childHeight || this.minMeasuredChildHeight || viewportHeight;
      const itemsPerRow = Math.max(
        Math.ceil(viewportWidth / defaultChildWidth),
        1
      );
      const itemsPerCol = Math.max(
        Math.ceil(viewportHeight / defaultChildHeight),
        1
      );
      wrapGroupsPerPage = this.horizontal ? itemsPerRow : itemsPerCol;
    } else {
      let scrollOffset =
        scrollElement[this._scrollType] -
        (this.previousViewPort ? this.previousViewPort.padding : 0);

      let arrayStartIndex = this.previousViewPort.startIndexWithBuffer || 0;
      let wrapGroupIndex = Math.ceil(arrayStartIndex / itemsPerWrapGroup);

      let maxWidthForWrapGroup = 0;
      let maxHeightForWrapGroup = 0;
      let sumOfVisibleMaxWidths = 0;
      let sumOfVisibleMaxHeights = 0;
      wrapGroupsPerPage = 0;

      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < content.children.length; ++i) {
        ++arrayStartIndex;
        const child = content.children[i];
        const clientRect = this.getElementSize(child);

        maxWidthForWrapGroup = Math.max(maxWidthForWrapGroup, clientRect.width);
        maxHeightForWrapGroup = Math.max(
          maxHeightForWrapGroup,
          clientRect.height
        );

        if (arrayStartIndex % itemsPerWrapGroup === 0) {
          const oldValue = this.wrapGroupDimensions.maxChildSizePerWrapGroup[
            wrapGroupIndex
          ];
          if (oldValue) {
            --this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
            this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths -=
              oldValue.childWidth || 0;
            this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights -=
              oldValue.childHeight || 0;
          }

          ++this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
          const items = this.items.slice(
            arrayStartIndex - itemsPerWrapGroup,
            arrayStartIndex
          );
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex] = {
            childWidth: maxWidthForWrapGroup,
            childHeight: maxHeightForWrapGroup,
            items,
          };
          this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths += maxWidthForWrapGroup;
          this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights += maxHeightForWrapGroup;

          if (this.horizontal) {
            let maxVisibleWidthForWrapGroup = Math.min(
              maxWidthForWrapGroup,
              Math.max(viewportWidth - sumOfVisibleMaxWidths, 0)
            );
            if (scrollOffset > 0) {
              const scrollOffsetToRemove = Math.min(
                scrollOffset,
                maxVisibleWidthForWrapGroup
              );
              maxVisibleWidthForWrapGroup -= scrollOffsetToRemove;
              scrollOffset -= scrollOffsetToRemove;
            }

            sumOfVisibleMaxWidths += maxVisibleWidthForWrapGroup;
            if (
              maxVisibleWidthForWrapGroup > 0 &&
              viewportWidth >= sumOfVisibleMaxWidths
            ) {
              ++wrapGroupsPerPage;
            }
          } else {
            let maxVisibleHeightForWrapGroup = Math.min(
              maxHeightForWrapGroup,
              Math.max(viewportHeight - sumOfVisibleMaxHeights, 0)
            );
            if (scrollOffset > 0) {
              const scrollOffsetToRemove = Math.min(
                scrollOffset,
                maxVisibleHeightForWrapGroup
              );
              maxVisibleHeightForWrapGroup -= scrollOffsetToRemove;
              scrollOffset -= scrollOffsetToRemove;
            }

            sumOfVisibleMaxHeights += maxVisibleHeightForWrapGroup;
            if (
              maxVisibleHeightForWrapGroup > 0 &&
              viewportHeight >= sumOfVisibleMaxHeights
            ) {
              ++wrapGroupsPerPage;
            }
          }

          ++wrapGroupIndex;

          maxWidthForWrapGroup = 0;
          maxHeightForWrapGroup = 0;
        }
      }

      const averageChildWidth =
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths /
        this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
      const averageChildHeight =
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights /
        this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
      defaultChildWidth = this.childWidth || averageChildWidth || viewportWidth;
      defaultChildHeight =
        this.childHeight || averageChildHeight || viewportHeight;

      if (this.horizontal) {
        if (viewportWidth > sumOfVisibleMaxWidths) {
          wrapGroupsPerPage += Math.ceil(
            (viewportWidth - sumOfVisibleMaxWidths) / defaultChildWidth
          );
        }
      } else {
        if (viewportHeight > sumOfVisibleMaxHeights) {
          wrapGroupsPerPage += Math.ceil(
            (viewportHeight - sumOfVisibleMaxHeights) / defaultChildHeight
          );
        }
      }
    }

    const itemCount = this.items.length;
    const itemsPerPage = itemsPerWrapGroup * wrapGroupsPerPage;
    const pageCountFractional = itemCount / itemsPerPage;
    const numberOfWrapGroups = Math.ceil(itemCount / itemsPerWrapGroup);

    let scrollLength = 0;

    const defaultScrollLengthPerWrapGroup = this.horizontal
      ? defaultChildWidth
      : defaultChildHeight;
    if (this.enableUnequalChildrenSizes) {
      let numUnknownChildSizes = 0;
      for (let i = 0; i < numberOfWrapGroups; ++i) {
        const childSize =
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i] &&
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i][
            this._childScrollDim
          ];
        if (childSize) {
          scrollLength += childSize;
        } else {
          ++numUnknownChildSizes;
        }
      }

      scrollLength += Math.round(
        numUnknownChildSizes * defaultScrollLengthPerWrapGroup
      );
    } else {
      scrollLength = numberOfWrapGroups * defaultScrollLengthPerWrapGroup;
    }

    if (this.headerElementRef) {
      scrollLength += this.headerElementRef.nativeElement.clientHeight;
    }

    const viewportLength = this.horizontal ? viewportWidth : viewportHeight;
    const maxScrollPosition = Math.max(scrollLength - viewportLength, 0);

    return {
      childHeight: defaultChildHeight,
      childWidth: defaultChildWidth,
      itemCount,
      itemsPerPage,
      itemsPerWrapGroup,
      maxScrollPosition,
      pageCount_fractional: pageCountFractional,
      scrollLength,
      viewportLength,
      wrapGroupsPerPage,
    };
  }

  protected calculatePadding(
    arrayStartIndexWithBuffer: number,
    dimensions: IDimensions
  ): number {
    if (dimensions.itemCount === 0) {
      return 0;
    }

    const defaultScrollLengthPerWrapGroup = dimensions[this._childScrollDim];
    const startingWrapGroupIndex =
      Math.floor(arrayStartIndexWithBuffer / dimensions.itemsPerWrapGroup) || 0;

    if (!this.enableUnequalChildrenSizes) {
      return defaultScrollLengthPerWrapGroup * startingWrapGroupIndex;
    }

    let numUnknownChildSizes = 0;
    let result = 0;
    for (let i = 0; i < startingWrapGroupIndex; ++i) {
      const childSize =
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[i] &&
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[i][
          this._childScrollDim
        ];
      if (childSize) {
        result += childSize;
      } else {
        ++numUnknownChildSizes;
      }
    }
    result += Math.round(
      numUnknownChildSizes * defaultScrollLengthPerWrapGroup
    );

    return result;
  }

  protected calculatePageInfo(
    scrollPosition: number,
    dimensions: IDimensions
  ): IPageInfo {
    let scrollPercentage = 0;
    if (this.enableUnequalChildrenSizes) {
      const numberOfWrapGroups = Math.ceil(
        dimensions.itemCount / dimensions.itemsPerWrapGroup
      );
      let totalScrolledLength = 0;
      const defaultScrollLengthPerWrapGroup = dimensions[this._childScrollDim];
      for (let i = 0; i < numberOfWrapGroups; ++i) {
        const childSize =
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i] &&
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i][
            this._childScrollDim
          ];
        if (childSize) {
          totalScrolledLength += childSize;
        } else {
          totalScrolledLength += defaultScrollLengthPerWrapGroup;
        }

        if (scrollPosition < totalScrolledLength) {
          scrollPercentage = i / numberOfWrapGroups;
          break;
        }
      }
    } else {
      scrollPercentage = scrollPosition / dimensions.scrollLength;
    }

    const startingArrayIndexFractional =
      Math.min(
        Math.max(scrollPercentage * dimensions.pageCount_fractional, 0),
        dimensions.pageCount_fractional
      ) * dimensions.itemsPerPage;

    const maxStart = dimensions.itemCount - dimensions.itemsPerPage - 1;
    let arrayStartIndex = Math.min(
      Math.floor(startingArrayIndexFractional),
      maxStart
    );
    arrayStartIndex -= arrayStartIndex % dimensions.itemsPerWrapGroup; // round down to start of wrapGroup

    if (this.stripedTable) {
      const bufferBoundary = 2 * dimensions.itemsPerWrapGroup;
      if (arrayStartIndex % bufferBoundary !== 0) {
        arrayStartIndex = Math.max(
          arrayStartIndex - (arrayStartIndex % bufferBoundary),
          0
        );
      }
    }

    let arrayEndIndex =
      Math.ceil(startingArrayIndexFractional) + dimensions.itemsPerPage - 1;
    const endIndexWithinWrapGroup =
      (arrayEndIndex + 1) % dimensions.itemsPerWrapGroup;
    if (endIndexWithinWrapGroup > 0) {
      arrayEndIndex += dimensions.itemsPerWrapGroup - endIndexWithinWrapGroup; // round up to end of wrapGroup
    }

    if (isNaN(arrayStartIndex)) {
      arrayStartIndex = 0;
    }
    if (isNaN(arrayEndIndex)) {
      arrayEndIndex = 0;
    }

    arrayStartIndex = Math.min(
      Math.max(arrayStartIndex, 0),
      dimensions.itemCount - 1
    );
    arrayEndIndex = Math.min(
      Math.max(arrayEndIndex, 0),
      dimensions.itemCount - 1
    );

    const bufferSize = this.bufferAmount * dimensions.itemsPerWrapGroup;
    const startIndexWithBuffer = Math.min(
      Math.max(arrayStartIndex - bufferSize, 0),
      dimensions.itemCount - 1
    );
    const endIndexWithBuffer = Math.min(
      Math.max(arrayEndIndex + bufferSize, 0),
      dimensions.itemCount - 1
    );

    return {
      startIndex: arrayStartIndex,
      endIndex: arrayEndIndex,
      startIndexWithBuffer,
      endIndexWithBuffer,
      scrollStartPosition: scrollPosition,
      scrollEndPosition: scrollPosition + dimensions.viewportLength,
      maxScrollPosition: dimensions.maxScrollPosition,
    };
  }

  protected calculateViewport(): IViewport {
    const dimensions = this.calculateDimensions();
    const offset = this.getElementsOffset();

    let scrollStartPosition = this.getScrollStartPosition();
    if (
      scrollStartPosition > dimensions.scrollLength + offset &&
      !(this.parentScroll instanceof Window)
    ) {
      scrollStartPosition = dimensions.scrollLength;
    } else {
      scrollStartPosition -= offset;
    }
    scrollStartPosition = Math.max(0, scrollStartPosition);

    const pageInfo = this.calculatePageInfo(scrollStartPosition, dimensions);
    const newPadding = this.calculatePadding(
      pageInfo.startIndexWithBuffer,
      dimensions
    );
    const newScrollLength = dimensions.scrollLength;

    return {
      startIndex: pageInfo.startIndex,
      endIndex: pageInfo.endIndex,
      startIndexWithBuffer: pageInfo.startIndexWithBuffer,
      endIndexWithBuffer: pageInfo.endIndexWithBuffer,
      padding: Math.round(newPadding),
      scrollLength: Math.round(newScrollLength),
      scrollStartPosition: pageInfo.scrollStartPosition,
      scrollEndPosition: pageInfo.scrollEndPosition,
      maxScrollPosition: pageInfo.maxScrollPosition,
    };
  }
}

@NgModule({
  exports: [VirtualScrollerComponent],
  declarations: [VirtualScrollerComponent],
  imports: [CommonModule],
  providers: [
    {
      provide: 'virtual-scroller-default-options',
      useFactory: VIRTUAL_SCROLLER_DEFAULT_OPTIONS_FACTORY,
    },
  ],
})
export class VirtualScrollerModule {}
