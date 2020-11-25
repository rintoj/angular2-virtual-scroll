import { Component, Input } from '@angular/core';
import { ListItem, ListItemComponent } from './list-item.component';
import { Chance } from 'chance';

@Component({
  template: '',
})
export class BaseListComponent {
  @Input()
  public get items(): ListItem[] {
    return this._items;
  }
  public set items(value: ListItem[]) {
    this._items = value;
    this.setToFullList();
  }

  constructor() {
    this.setToFullList();
  }

  public static index = 0;
  public static chance = new Chance(0); // 0 = seed for repeatability
  protected _items: ListItem[];

  public ListItemComponent = ListItemComponent;
  public randomSize = false;

  public filteredList: ListItem[];
  public static generateRandomItem(): ListItem {
    return {
      id: BaseListComponent.chance.guid(),
      index: BaseListComponent.index++,
      name: BaseListComponent.chance.name(),
      gender: BaseListComponent.chance.gender(),
      age: BaseListComponent.chance.age(),
      email: BaseListComponent.chance.email(),
      phone: BaseListComponent.chance.phone(),
      address:
        BaseListComponent.chance.address() +
        ', ' +
        BaseListComponent.chance.city() +
        ', ' +
        BaseListComponent.chance.state() +
        ', ' +
        BaseListComponent.chance.zip(),
      company: BaseListComponent.chance.company(),
    };
  }

  public static generateMultipleRandomItems(count: number): ListItem[] {
    const result = Array(count);
    for (let i = 0; i < count; ++i) {
      result[i] = BaseListComponent.generateRandomItem();
    }

    return result;
  }

  public prependItems(): void {
    this.filteredList.unshift.apply(
      this.filteredList,
      BaseListComponent.generateMultipleRandomItems(10)
    );
  }

  public appendItems(): void {
    this.filteredList.push.apply(
      this.filteredList,
      BaseListComponent.generateMultipleRandomItems(10)
    );
  }

  public reduceListToEmpty() {
    this.filteredList = [];
  }

  public reduceList() {
    this.filteredList = this.filteredList.slice(0, 100);
  }

  public sortByName() {
    this.filteredList.sort(
      (a, b) => -(a.name < b.name) || +(a.name !== b.name)
    );
  }

  public sortByIndex() {
    this.filteredList.sort(
      (a, b) => -(a.index < b.index) || +(a.index !== b.index)
    );
  }

  public setToFullList() {
    this.filteredList = [].concat(this.items || []) || [];
  }
}
