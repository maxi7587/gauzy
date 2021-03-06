import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { LocalDataSource } from 'ng2-smart-table';
import {
	IInvoice,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { InvoicePaidComponent } from '../table-components/invoice-paid.component';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';

@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = true;
	private _ngDestroy$ = new Subject<void>();
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedInvoice: IInvoice;
	invoices: IInvoice[];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;

	@Input() isEstimate: boolean;
	@ViewChild('invoicesTable') invoicesTable;

	constructor(
		private store: Store,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private router: Router,
		private _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		if (!this.isEstimate) {
			this.isEstimate = false;
		}
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				takeUntil(this._ngDestroy$)
			)
			.subscribe((organization) => {
				this.organization = organization;
				if (organization) {
					this.getInvoices();
				}
			});

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.INVOICE_RECEIVED;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async getInvoices() {
		try {
			const { id: organizationId, tenantId } = this.organization;
			const invoices = await this.invoicesService.getAll(['payments'], {
				sentTo: organizationId,
				isEstimate: this.isEstimate,
				tenantId
			});
			this.loading = false;
			this.invoices = invoices.items;
			this.smartTableSource.load(invoices.items);
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	view(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.isEstimate) {
			this.router.navigate([
				`/pages/accounting/invoices/estimates/view/${this.selectedInvoice.id}`
			]);
		} else {
			this.router.navigate([
				`/pages/accounting/invoices/view/${this.selectedInvoice.id}`
			]);
		}
	}

	async accept(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		await this.invoicesService.update(this.selectedInvoice.id, {
			isAccepted: true
		});
		await this.getInvoices();
	}

	async reject(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		await this.invoicesService.update(this.selectedInvoice.id, {
			isAccepted: false
		});
		await this.getInvoices();
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_NUMBER')
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'string',
					sortDirection: 'asc'
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'string',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${cell}`;
					}
				}
			}
		};
		if (!this.isEstimate) {
			this.settingsSmartTable['columns']['paid'] = {
				title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
				type: 'custom',
				renderComponent: InvoicePaidComponent,
				filter: false,
				width: '33%'
			};
		}
	}

	selectInvoice({ isSelected, data }) {
		const selectedInvoice = isSelected ? data : null;
		if (this.invoicesTable) {
			this.invoicesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedInvoice = selectedInvoice;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
