import { Component } from '@angular/core';
import { BaseListComponent } from '../lists/base-list';

@Component({
  selector: 'app-parent-scroll',
  template: `
    <h1>Window/Parent Scroll</h1>
    <button (click)="sortByName()">Sort By Name</button>
    <button (click)="sortByIndex()">Sort By Index</button>
    <button (click)="prependItems()">Prepend 10 Items</button>
    <button (click)="appendItems()">Append 10 Items</button>
    <button (click)="reduceListToEmpty()">Reduce to 0 Items</button>
    <button (click)="reduceList()">Reduce to 100 Items</button>
    <button (click)="setToFullList()">Revert to original Items</button>
    <button (click)="scroll.scrollToIndex(50)">Scroll to index 50</button>
    <button (click)="scroll.scrollToPosition(1500)">
      Scroll to position 1500
    </button>
    <button (click)="randomSize = !randomSize">Toggle Random Height</button>
    <button *ngIf="randomSize" (click)="ListItemComponent.ResetSeed()">
      Re-Randomize Item Sizes
    </button>
    <button
      *ngIf="randomSize"
      (click)="scroll.invalidateAllCachedMeasurements()"
    >
      Invalidate cached measurements
    </button>

    <div class="status">
      Showing <span>{{ scroll.viewPortInfo.startIndex }}</span> -
      <span>{{ scroll.viewPortInfo.endIndex }}</span> of
      <span>{{ filteredList?.length }}</span>
      <span>({{ scroll.viewPortItems?.length }} nodes)</span>
      <span
        >[scrollStartPosition: {{ scroll.viewPortInfo.scrollStartPosition }}px,
        scrollEndPosition: {{ scroll.viewPortInfo.scrollEndPosition }}px,
        maxScrollPosition: {{ scroll.viewPortInfo.maxScrollPosition }}px ]</span
      >
    </div>

    <virtual-scroller
      #scroll
      [parentScroll]="scroll.window"
      [enableUnequalChildrenSizes]="randomSize"
      [items]="filteredList"
    >
      <app-list-item
        [randomHeight]="randomSize"
        *ngFor="let item of scroll.viewPortItems"
        [item]="item"
      >
      </app-list-item>
    </virtual-scroller>
  `,
})
export class ParentScrollComponent extends BaseListComponent {
  constructor() {
    super();

    this.items = BaseListComponent.generateMultipleRandomItems(10000);
    this.setToFullList();
  }
}
