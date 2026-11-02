import { Component, DestroyRef, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  Agent,
  AGENT_MODE_LABELS,
  AGENT_MODES,
  AgentMode,
  AgentStatus,
  AgentVersion,
  CallSettings,
  Currency,
  CURRENCIES,
  McpServer,
  Tool,
} from '../../../core/models/agent.model';
import { AgentTemplate, templateIcon } from '../../../core/models/agent-template.model';
import {
  PhoneNumber,
  phoneNumberCountryName,
  phoneNumberDisplayLabel,
  phoneNumberE164,
  toNationalNumber,
} from '../../../core/models/phone-number.model';
import { COUNTRY_CODES } from '../../../shared/constants/countries.constant';
import { LANGUAGES } from '../../../shared/constants/languages.constant';
import { AGENT_VOICES, DEFAULT_AGENT_VOICE } from '../../../shared/constants/agent-voices.constant';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AgentService } from '../../../core/services/agent.service';
import { AgentTemplateService } from '../../../core/services/agent-template.service';
import { PhoneNumberService } from '../../../core/services/phone-number.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ExportDestinationsComponent } from '../export-destinations/export-destinations.component';
import { McpServersManagerComponent } from '../mcp-servers-manager/mcp-servers-manager.component';
import { AgentHistoryPanelComponent } from '../agent-history-panel/agent-history-panel.component';
import { AgentKnowledgeBasesComponent } from '../agent-knowledge-bases/agent-knowledge-bases.component';
import { AgentPropertiesComponent } from '../agent-properties/agent-properties.component';
import { PreviewPanelComponent } from '../preview-panel/preview-panel.component';
import { AgentCallSettingsComponent } from '../agent-call-settings/agent-call-settings.component';
import { ModalComponent } from '../../../shared/modal/modal.component';
import { isSalesTemplate } from '../../../shared/constants/agent-templates.constant';

type PlaygroundField = 'agent_name' | 'greeting' | 'prompt' | 'behavior';
type EditorTab = 'build' | 'calling' | 'integrations' | 'mcp-servers' | 'preview';

const AGENT_MODE_ICONS: Record<AgentMode, string> = {
  chatbot: 'fa-comment-dots',
  voice: 'fa-phone-volume',
  both: 'fa-layer-group',
};

/** Lifecycle shown in the header tracker; `disabled` is shown as a paused live agent. */
const LIFECYCLE: AgentStatus[] = ['draft', 'staged', 'live'];

@Component({
  selector: 'app-playground-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ExportDestinationsComponent,
    McpServersManagerComponent,
    AgentHistoryPanelComponent,
    AgentKnowledgeBasesComponent,
    AgentPropertiesComponent,
    PreviewPanelComponent,
    ModalComponent,
    AgentCallSettingsComponent,
  ],
  templateUrl: './playground-editor.component.html',
  styleUrl: './playground-editor.component.css',
})
export class PlaygroundEditorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly agentService = inject(AgentService);
  private readonly agentTemplateService = inject(AgentTemplateService);
  private readonly phoneNumberService = inject(PhoneNumberService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currencies = CURRENCIES;
  readonly agentModes = AGENT_MODES;
  readonly agentModeLabels = AGENT_MODE_LABELS;
  readonly agentModeIcons = AGENT_MODE_ICONS;
  readonly lifecycle = LIFECYCLE;
  readonly tabs: { id: EditorTab; label: string; icon: string }[] = [
    { id: 'build', label: 'Build', icon: 'fa-pen-ruler' },
    { id: 'calling', label: 'Calling', icon: 'fa-clock' },
    { id: 'integrations', label: 'Integrations', icon: 'fa-share-nodes' },
    { id: 'mcp-servers', label: 'MCP Servers', icon: 'fa-server' },
    { id: 'preview', label: 'Preview', icon: 'fa-phone-volume' },
  ];
  readonly languages = LANGUAGES;
  readonly voices = AGENT_VOICES;
  readonly countryNames = [...new Set(COUNTRY_CODES.map((c) => c.name))];
  readonly phoneNumberDisplayLabel = phoneNumberDisplayLabel;

  readonly form = this.fb.nonNullable.group({
    agent_name: [''],
    agent_mode: ['both' as AgentMode],
    language: ['en'],
    voice: [DEFAULT_AGENT_VOICE],
    agent_country: [''],
    phone_number_id: [''],
    greeting: [''],
    prompt: [''],
    behavior: [''],
    referral_amount: [0],
    referral_currency: ['USD'],
  });

  readonly availablePhoneNumbers = signal<PhoneNumber[]>([]);
  private readonly loadedPhoneNumberId = signal<string | undefined>(undefined);

  /** Production number picked at go-live time — separate from the staging `phone_number_id` above. */
  readonly productionPhoneNumbers = signal<PhoneNumber[]>([]);
  readonly productionPhoneNumberId = signal<string>('');
  /** Production number this agent is already live on, if any — preselected at go-live. */
  readonly currentLiveNumberId = signal<string | null>(null);
  readonly goLiveModalOpen = signal(false);

  readonly template = signal<AgentTemplate | null>(null);
  /** Properties section (sidebar) is only shown for Real Estate Sales agents. */
  readonly templateIconClass = computed(() => templateIcon(this.template()?.template_id));
  /** Index of the current status in the draft → staged → live tracker (disabled counts as having reached live). */
  readonly lifecycleIndex = computed(() => {
    const status = this.status();
    return status === 'disabled' ? LIFECYCLE.length - 1 : LIFECYCLE.indexOf(status);
  });
  readonly isSalesAgent = computed(() => isSalesTemplate(this.template()?.template_id));
  readonly agentId = signal<string | null>(null);
  readonly status = signal<AgentStatus>('draft');
  readonly currentStageVersion = signal(0);
  readonly tools = signal<Tool[]>([]);
  readonly mcpServers = signal<McpServer[]>([]);
  readonly knowledgeBaseIds = signal<string[]>([]);
  /** Edited in the Calling tab and saved on its own, so it never reverts the status. */
  readonly callSettings = signal<CallSettings | undefined>(undefined);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly stagingAgent = signal(false);
  readonly goingLive = signal(false);
  readonly cloning = signal(false);
  readonly previewPassed = signal(false);

  readonly activeTab = signal<EditorTab>('build');
  readonly historyPanelOpen = signal(false);

  private readonly toolsWatcher = effect(() => {
    this.tools();
    this.mcpServers();
    this.knowledgeBaseIds();
    untracked(() => this.invalidatePreview());
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.loadFromParams(params));
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.invalidatePreview());
    this.form.controls.agent_country.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((countryName) => this.onCountryChange(countryName));
  }

  private loadFromParams(params: ParamMap): void {
    const templateId = params.get('templateId');
    const id = params.get('id');

    if (id && id === this.agentId()) {
      // We navigated here ourselves after creating/updating this exact agent; local state is already current.
      return;
    }

    this.loading.set(true);
    this.template.set(null);
    this.agentId.set(null);
    this.status.set('draft');
    this.currentStageVersion.set(0);
    this.tools.set([]);
    this.mcpServers.set([]);
    this.knowledgeBaseIds.set([]);
    this.callSettings.set(undefined);
    this.previewPassed.set(false);
    this.activeTab.set('build');
    this.historyPanelOpen.set(false);
    this.availablePhoneNumbers.set([]);
    this.loadedPhoneNumberId.set(undefined);
    this.productionPhoneNumbers.set([]);
    this.productionPhoneNumberId.set('');
    this.currentLiveNumberId.set(null);
    this.goLiveModalOpen.set(false);
    this.form.reset({
      agent_name: '',
      agent_mode: 'both',
      language: 'en',
      voice: DEFAULT_AGENT_VOICE,
      agent_country: '',
      phone_number_id: '',
      greeting: '',
      prompt: '',
      behavior: '',
      referral_amount: 0,
      referral_currency: 'USD',
    });

    if (templateId) {
      this.agentTemplateService.getTemplate(templateId).subscribe((template) => {
        if (!template) {
          this.toast.error('Template not found');
          this.router.navigateByUrl('/playground/new');
          return;
        }
        this.template.set(template);
        this.form.patchValue({
          agent_name: template.name,
          greeting: template.default_greeting,
          prompt: template.default_prompt,
          behavior: template.default_behavior,
        });
        this.loading.set(false);
      });
      return;
    }

    if (id) {
      this.agentService.getAgent(id).subscribe({
        next: (agent) => this.loadExistingAgent(agent),
        error: () => {
          this.toast.error('Agent not found');
          this.router.navigateByUrl('/dashboard');
        },
      });
      return;
    }

    this.router.navigateByUrl('/playground/new');
  }

  private loadExistingAgent(agent: Agent): void {
    this.agentId.set(agent.id);
    this.status.set(agent.status);
    this.currentStageVersion.set(agent.current_stage_version);
    this.tools.set(agent.tools);
    this.mcpServers.set(agent.mcp_servers);
    this.knowledgeBaseIds.set(agent.knowledge_base_ids);
    this.callSettings.set(agent.call_settings);
    this.form.patchValue({
      agent_name: agent.agent_name,
      agent_mode: agent.agent_mode ?? 'both',
      language: agent.language ?? 'en',
      voice: agent.voice ?? DEFAULT_AGENT_VOICE,
      agent_country: '',
      phone_number_id: '',
      greeting: agent.greeting ?? '',
      prompt: agent.prompt ?? '',
      behavior: agent.behavior ?? '',
      referral_amount: agent.referral_bonus?.amount ?? 0,
      referral_currency: agent.referral_bonus?.currency ?? 'USD',
    });
    this.availablePhoneNumbers.set([]);
    this.hydratePhoneFields(agent, { recordLoaded: true });

    if (agent.base_template_id) {
      this.agentTemplateService.getTemplate(agent.base_template_id).subscribe((template) => {
        this.template.set(template ?? null);
        this.loading.set(false);
      });
    } else {
      this.loading.set(false);
    }
  }

  private defaultFor(field: PlaygroundField): string {
    const template = this.template();
    if (!template) return '';
    switch (field) {
      case 'agent_name':
        return template.name;
      case 'greeting':
        return template.default_greeting;
      case 'prompt':
        return template.default_prompt;
      case 'behavior':
        return template.default_behavior;
    }
  }

  resetField(field: PlaygroundField): void {
    this.form.controls[field].setValue(this.defaultFor(field));
  }

  resetAll(): void {
    this.form.patchValue({
      agent_name: this.defaultFor('agent_name'),
      greeting: this.defaultFor('greeting'),
      prompt: this.defaultFor('prompt'),
      behavior: this.defaultFor('behavior'),
    });
  }

  private fallbackValue(field: PlaygroundField): string {
    const value = this.form.controls[field].value.trim();
    return value || this.defaultFor(field);
  }

  private invalidatePreview(): void {
    this.previewPassed.set(false);
  }

  onPreviewPassed(): void {
    this.previewPassed.set(true);
  }

  selectTab(tab: EditorTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Production numbers for the agent's country that are Available and either unassigned or
   * already this agent's (so re-publishing can keep its current live number). The server
   * enforces the same rules on go-live. The agent's current live number is preselected.
   */
  private loadProductionPhoneNumbers(): void {
    const countryName = this.form.controls.agent_country.value;
    const country = COUNTRY_CODES.find((c) => c.name === countryName);
    if (!country) {
      this.productionPhoneNumbers.set([]);
      return;
    }
    this.phoneNumberService.getPhoneNumbers().subscribe((numbers) => {
      const agentId = this.agentId();
      const filtered = numbers.filter(
        (n) =>
          n.country_code === country.code &&
          n.environmentType === 'production' &&
          n.status === 'Available' &&
          (n.assigned_agent == null || n.assigned_agent === agentId),
      );
      this.productionPhoneNumbers.set(filtered);

      // Stage numbers are staging-only, so a production number on this agent is its live one.
      const liveNumber = filtered.find((n) => n.assigned_agent === agentId);
      this.currentLiveNumberId.set(liveNumber?.id ?? null);

      const currentId = this.productionPhoneNumberId();
      if (!currentId || !filtered.some((n) => n.id === currentId)) {
        this.productionPhoneNumberId.set(liveNumber?.id ?? '');
      }
    });
  }

  onProductionPhoneNumberChange(event: Event): void {
    this.productionPhoneNumberId.set((event.target as HTMLSelectElement).value);
  }

  onToolsChange(tools: Tool[]): void {
    this.tools.set(tools);
  }

  onMcpServersChange(mcpServers: McpServer[]): void {
    this.mcpServers.set(mcpServers);
  }

  onKnowledgeBaseIdsChange(ids: string[]): void {
    this.knowledgeBaseIds.set(ids);
  }

  toggleHistoryPanel(): void {
    this.historyPanelOpen.update((open) => !open);
  }

  onRestoreVersion(version: AgentVersion): void {
    const snapshot = version.snapshot;
    this.form.patchValue({
      agent_name: snapshot.agent_name,
      agent_mode: snapshot.agent_mode ?? 'both',
      language: snapshot.language ?? 'en',
      // Older version snapshots don't record a voice — keep the current one.
      ...(snapshot.voice ? { voice: snapshot.voice } : {}),
      greeting: snapshot.greeting ?? '',
      prompt: snapshot.prompt ?? '',
      behavior: snapshot.behavior ?? '',
      referral_amount: snapshot.referral_bonus?.amount ?? 0,
      referral_currency: snapshot.referral_bonus?.currency ?? 'USD',
    });
    this.hydratePhoneFields(snapshot, { recordLoaded: false });
    this.tools.set(snapshot.tools);
    this.mcpServers.set(snapshot.mcp_servers);
    this.knowledgeBaseIds.set(snapshot.knowledge_base_ids);
    this.historyPanelOpen.set(false);
    this.toast.success(`Restored to version #${version.versionNumber}. Save to keep these changes.`);
  }

  private buildPayload(): Partial<Agent> {
    const template = this.template();
    const agentMode = this.form.controls.agent_mode.value;
    const selectedPhoneId = this.form.controls.phone_number_id.value || undefined;
    const selectedPhone = this.availablePhoneNumbers().find((n) => n.id === selectedPhoneId);
    const payload: Partial<Agent> = {
      agent_name: this.fallbackValue('agent_name'),
      agent_mode: agentMode,
      language: this.form.controls.language.value,
      voice: this.form.controls.voice.value,
      enable_voice: agentMode !== 'chatbot',
      phone_number_id: selectedPhoneId,
      greeting: this.fallbackValue('greeting'),
      prompt: this.fallbackValue('prompt'),
      behavior: this.fallbackValue('behavior'),
      tools: this.tools(),
      mcp_servers: this.mcpServers(),
      knowledge_base_ids: this.knowledgeBaseIds(),
    };
    if (selectedPhone) {
      // API expects dial fields; phone library still uses local ids until phones API exists.
      payload.phone_number = phoneNumberE164(selectedPhone);
      payload.country_code = selectedPhone.country_code;
    }
    if (template?.referral_bonus_eligible) {
      payload.referral_bonus = {
        amount: this.form.controls.referral_amount.value,
        currency: this.form.controls.referral_currency.value as Currency,
      };
    }
    return payload;
  }

  private persist(): Observable<Agent> | null {
    const payload = this.buildPayload();
    const existingId = this.agentId();
    if (existingId) {
      return this.agentService.updateAgent(existingId, payload);
    }

    const template = this.template();
    if (!template) return null;
    return this.agentService.createAgent({
      ...payload,
      status: 'draft',
      base_template_id: template.template_id,
    });
  }

  // Save/Preview may substitute template defaults for blank fields before persisting
  // (see fallbackValue()). Without this, the form keeps showing what the user typed
  // (e.g. blank) even though the server actually stored the fallback value — making
  // it look like the save silently ignored the input.
  private syncFormFromAgent(agent: Agent): void {
    this.form.patchValue(
      {
        agent_name: agent.agent_name,
        agent_mode: agent.agent_mode ?? 'both',
        language: agent.language ?? 'en',
        voice: agent.voice ?? DEFAULT_AGENT_VOICE,
        greeting: agent.greeting ?? '',
        prompt: agent.prompt ?? '',
        behavior: agent.behavior ?? '',
      },
      { emitEvent: false }
    );
    this.mcpServers.set(agent.mcp_servers ?? []);
    this.knowledgeBaseIds.set(agent.knowledge_base_ids ?? []);
    this.hydratePhoneFields(agent, { recordLoaded: true });
  }

  // Refreshes the number dropdown for a country and drops the current selection if it no
  // longer belongs to that country (e.g. the user just switched countries).
  private refreshAvailableNumbers(countryName: string, currentPhoneNumberId?: string): void {
    if (!countryName) {
      this.availablePhoneNumbers.set([]);
      if (this.form.controls.phone_number_id.value) {
        this.form.controls.phone_number_id.setValue('', { emitEvent: false });
      }
      return;
    }
    this.phoneNumberService.getAvailableForCountry(countryName, currentPhoneNumberId).subscribe((numbers) => {
      this.availablePhoneNumbers.set(numbers);
      const currentId = this.form.controls.phone_number_id.value;
      if (currentId && !numbers.some((n) => n.id === currentId)) {
        this.form.controls.phone_number_id.setValue('', { emitEvent: false });
      }
    });
  }

  private onCountryChange(countryName: string): void {
    const currentId = this.form.controls.phone_number_id.value;
    this.refreshAvailableNumbers(countryName, currentId || undefined);
  }

  private findPhoneByDialFields(
    numbers: PhoneNumber[],
    countryCode?: string,
    phoneNumber?: string,
  ): PhoneNumber | undefined {
    if (!phoneNumber) return undefined;
    return numbers.find((n) => {
      if (countryCode && n.country_code !== countryCode) return false;
      const national = toNationalNumber(n.country_code, phoneNumber);
      return (
        phoneNumberE164(n) === phoneNumber ||
        n.phone_number === phoneNumber ||
        n.phone_number === national
      );
    });
  }

  private countryNameFromCode(countryCode: string | undefined): string {
    if (!countryCode) return '';
    return COUNTRY_CODES.find((c) => c.code === countryCode)?.name ?? '';
  }

  /**
   * Patch country + phone selects from an agent. Prefers `phone_number_id` when present;
   * otherwise resolves against the phone library using API `country_code` / `phone_number`.
   */
  private hydratePhoneFields(
    agent: Pick<Agent, 'phone_number_id' | 'country_code' | 'phone_number'>,
    options: { recordLoaded: boolean },
  ): void {
    const finish = (phoneNumberId: string | undefined) => {
      if (options.recordLoaded) {
        this.loadedPhoneNumberId.set(phoneNumberId);
      }
      this.applyPhoneNumberSelection(phoneNumberId);
    };

    if (agent.phone_number_id) {
      finish(agent.phone_number_id);
      return;
    }

    if (!agent.country_code && !agent.phone_number) {
      finish(undefined);
      return;
    }

    this.phoneNumberService.getPhoneNumbers().subscribe((numbers) => {
      const match = this.findPhoneByDialFields(numbers, agent.country_code, agent.phone_number);
      if (match) {
        finish(match.id);
        return;
      }

      // No library row — still show country from the dial code so the form isn't blank.
      if (options.recordLoaded) {
        this.loadedPhoneNumberId.set(undefined);
      }
      const countryName = this.countryNameFromCode(agent.country_code);
      this.form.patchValue({ agent_country: countryName, phone_number_id: '' }, { emitEvent: false });
      if (countryName) {
        this.refreshAvailableNumbers(countryName);
      } else {
        this.availablePhoneNumbers.set([]);
      }
    });
  }

  // Populates the country/number selects to reflect a given phone number assignment
  // (or clears them) without touching loadedPhoneNumberId — used for non-authoritative
  // form updates like previewing a restored version, which still requires Save to commit.
  private applyPhoneNumberSelection(phoneNumberId: string | undefined): void {
    if (!phoneNumberId) {
      this.form.patchValue({ agent_country: '', phone_number_id: '' }, { emitEvent: false });
      this.availablePhoneNumbers.set([]);
      return;
    }
    this.phoneNumberService.getPhoneNumber(phoneNumberId).subscribe((phoneNumber) => {
      const countryName = phoneNumberCountryName(phoneNumber);
      this.form.patchValue(
        { agent_country: countryName, phone_number_id: phoneNumber.id },
        { emitEvent: false }
      );
      this.refreshAvailableNumbers(countryName, phoneNumber.id);
    });
  }

  private syncPhoneNumberAssignment(previousId: string | undefined, nextId: string | undefined, agentId: string): void {
    if (previousId === nextId) return;
    if (previousId) {
      this.phoneNumberService.unassignFromAgent(previousId).subscribe();
    }
    if (nextId) {
      this.phoneNumberService.assignToAgent(nextId, agentId).subscribe();
    }
  }

  private settleCreated(created: Agent): void {
    this.agentId.set(created.id);
    this.status.set(created.status);
    this.currentStageVersion.set(created.current_stage_version);
    // Update the URL without going through the Router: `new/:templateId` and `:id` are different
    // route configs, so a Router navigation between them destroys and recreates this component,
    // losing in-flight state (e.g. a just-completed preview). Location.replaceState only updates
    // the address bar/history, leaving this component instance (and its state) untouched.
    this.location.replaceState(`/playground/${created.id}`);
  }

  private doSave(): void {
    const previousPhoneNumberId = this.loadedPhoneNumberId();
    const request = this.persist();
    if (!request) return;

    const isNew = !this.agentId();
    this.saving.set(true);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.status.set(result.status);
        this.currentStageVersion.set(result.current_stage_version);
        this.syncFormFromAgent(result);
        this.syncPhoneNumberAssignment(previousPhoneNumberId, result.phone_number_id, result.id);
        if (isNew) {
          this.settleCreated(result);
          this.toast.success('Draft saved');
        } else {
          this.toast.success('Agent saved');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Failed to save agent'));
      },
    });
  }

  save(): void {
    const status = this.status();
    // Editing a staged/live/disabled agent reverts it to draft server-side (archiving the
    // current version) — warn before that happens rather than surprising the user after.
    if (this.agentId() && status !== 'draft') {
      this.confirmDialog
        .confirm({
          title: 'Save changes?',
          message: 'Saving will move this agent back to Draft and archive its current version. Continue?',
          confirmLabel: 'Save',
        })
        .subscribe((confirmed) => {
          if (confirmed) this.doSave();
        });
      return;
    }
    this.doSave();
  }

  goBack(): void {
    this.location.back();
  }

  cancel(): void {
    this.router.navigateByUrl(this.agentId() ? '/dashboard' : '/playground/new');
  }

  clone(): void {
    const id = this.agentId();
    if (!id) return;

    this.cloning.set(true);
    this.agentService.cloneAgent(id).subscribe({
      next: (created) => {
        this.cloning.set(false);
        this.toast.success(`Cloned as "${created.agent_name}"`);
        this.router.navigate(['/playground', created.id]);
      },
      error: () => {
        this.cloning.set(false);
        this.toast.error('Failed to clone agent');
      },
    });
  }

  moveToStaging(): void {
    const id = this.agentId();
    if (!id || this.status() !== 'draft') return;

    this.stagingAgent.set(true);
    this.agentService.stageAgent(id).subscribe({
      next: (updated) => {
        this.stagingAgent.set(false);
        this.status.set(updated.status);
        this.currentStageVersion.set(updated.current_stage_version);
        this.toast.success('Agent moved to staging');
      },
      error: (err) => {
        this.stagingAgent.set(false);
        this.toast.error(extractErrorMessage(err, 'Failed to move agent to staging'));
      },
    });
  }

  openGoLiveModal(): void {
    if (!this.agentId()) return;
    this.loadProductionPhoneNumbers();
    this.goLiveModalOpen.set(true);
  }

  cancelGoLive(): void {
    this.goLiveModalOpen.set(false);
  }

  confirmGoLive(): void {
    const id = this.agentId();
    if (!id) return;

    const selectedPhone = this.productionPhoneNumbers().find((n) => n.id === this.productionPhoneNumberId());
    if (!selectedPhone) {
      this.toast.error('Select a production phone number before going live');
      return;
    }
    this.goingLive.set(true);
    // Server re-validates the preview hash; a stale preview (edited since last Preview) 409s.
    this.agentService.goLive(id, selectedPhone.id).subscribe({
      next: (updated) => {
        this.goingLive.set(false);
        this.goLiveModalOpen.set(false);
        this.status.set(updated.status);
        this.currentStageVersion.set(updated.current_stage_version);
        this.toast.success('Agent is now live');
      },
      error: (err) => {
        this.goingLive.set(false);
        this.previewPassed.set(false);
        this.toast.error(extractErrorMessage(err, 'Failed to go live'));
      },
    });
  }
}
