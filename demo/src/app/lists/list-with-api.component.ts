import { Component, OnChanges } from '@angular/core';
import { ListItem } from './list-item.component';
import { BaseListComponent } from './base-list';
import { IPageInfo } from 'ngx-virtual-scroller';

@Component({
  selector: 'app-list-with-api',
  template: `
    <label
      >Add items at Top
      <input
        type="checkbox"
        (change)="shouldPrependItems = !shouldPrependItems"
    /></label>
    <button (click)="sortByName()">Sort By Name</button>
    <button (click)="sortByIndex()">Sort By Index</button>
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
      <span>{{ items?.length }}</span>
      <span>({{ scroll.viewPortItems?.length }} nodes)</span>
      <span
        >[scrollStartPosition: {{ scroll.viewPortInfo.scrollStartPosition }}px,
        scrollEndPosition: {{ scroll.viewPortInfo.scrollEndPosition }}px,
        maxScrollPosition: {{ scroll.viewPortInfo.maxScrollPosition }}px ]</span
      >
    </div>

    <virtual-scroller
      #scroll
      [enableUnequalChildrenSizes]="randomSize"
      [items]="filteredList"
      (vsStart)="shouldPrependItems && fetchMore($event)"
      (vsEnd)="!shouldPrependItems && fetchMore($event)"
    >
      <app-list-item
        [randomHeight]="randomSize"
        *ngFor="let item of scroll.viewPortItems"
        [item]="item"
      >
      </app-list-item>
      <div *ngIf="loading" class="loader">Loading...</div>
    </virtual-scroller>
  `,
  styleUrls: ['./list-with-api.scss'],
})
export class ListWithApiComponent
  extends BaseListComponent
  implements OnChanges {
  public shouldPrependItems = false;
  public timer;
  public loading = false;

  public ngOnChanges() {
    this.filteredList = [];
    this.reset();
  }

  private reset() {
    this.fetchNextChunk();
  }

  public fetchMore(event: IPageInfo) {
    if (this.shouldPrependItems && event.startIndex === 0) {
      this.fetchNextChunk();
    }
    if (
      !this.shouldPrependItems &&
      event.endIndex === this.filteredList.length - 1
    ) {
      this.fetchNextChunk();
    }
  }

  private fetchNextChunk(): void {
    this.loading = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.loading = false;

      if (this.shouldPrependItems) {
        this.prependItems();
      } else {
        this.appendItems();
      }
    }, 1000 + Math.random() * 1000);
  }
}
