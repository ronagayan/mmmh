package com.ronagayan.nfcmaster

import android.app.AlertDialog
import android.content.Context
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView

class Field(
    val key: String,
    val labelRes: Int,
    val kind: Int = TEXT,
    val options: List<Pair<String, String>> = emptyList(),
    val default: String = "",
    val inputType: Int = InputType.TYPE_CLASS_TEXT,
    val required: Boolean = true,
    val multiline: Boolean = false
) {
    companion object {
        const val TEXT = 0
        const val CHOICE = 1
        const val CHECK = 2
    }
}

object Forms {

    fun show(ctx: Context, title: CharSequence, fields: List<Field>, okRes: Int = R.string.ok, onOk: (Map<String, String>) -> Boolean) {
        val pad = Ui.dp(ctx, 20)
        val container = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, Ui.dp(ctx, 8), pad, 0)
        }
        val widgets = HashMap<String, View>()
        for (f in fields) {
            val label = TextView(ctx).apply {
                text = ctx.getString(f.labelRes)
                setTextAppearance(R.style.Caption)
                setPadding(0, Ui.dp(ctx, 10), 0, Ui.dp(ctx, 4))
            }
            when (f.kind) {
                Field.CHOICE -> {
                    container.addView(label)
                    val sp = Spinner(ctx)
                    sp.adapter = ArrayAdapter(ctx, android.R.layout.simple_spinner_dropdown_item, f.options.map { it.second })
                    val idx = f.options.indexOfFirst { it.first == f.default }
                    if (idx >= 0) sp.setSelection(idx)
                    container.addView(sp)
                    widgets[f.key] = sp
                }
                Field.CHECK -> {
                    val cb = CheckBox(ctx).apply {
                        text = ctx.getString(f.labelRes)
                        isChecked = f.default == "true"
                        setPadding(0, Ui.dp(ctx, 6), 0, 0)
                    }
                    container.addView(cb)
                    widgets[f.key] = cb
                }
                else -> {
                    container.addView(label)
                    val et = EditText(ctx).apply {
                        setBackgroundResource(R.drawable.bg_input)
                        setPadding(Ui.dp(ctx, 12), Ui.dp(ctx, 12), Ui.dp(ctx, 12), Ui.dp(ctx, 12))
                        setText(f.default)
                        inputType = if (f.multiline) f.inputType or InputType.TYPE_TEXT_FLAG_MULTI_LINE else f.inputType
                        if (f.multiline) { minLines = 3; gravity = Gravity.TOP or Gravity.START }
                        textSize = 15f
                    }
                    container.addView(et)
                    widgets[f.key] = et
                }
            }
        }
        val scroll = ScrollView(ctx).apply { addView(container) }
        val dialog = AlertDialog.Builder(ctx)
            .setTitle(title)
            .setView(scroll)
            .setPositiveButton(okRes, null)
            .setNegativeButton(R.string.cancel, null)
            .create()
        dialog.show()
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val values = HashMap<String, String>()
            var valid = true
            for (f in fields) {
                val w = widgets[f.key]
                val v = when (w) {
                    is Spinner -> f.options.getOrNull(w.selectedItemPosition)?.first ?: ""
                    is CheckBox -> if (w.isChecked) "true" else "false"
                    is EditText -> w.text.toString()
                    else -> ""
                }
                if (f.required && f.kind == Field.TEXT && v.isBlank()) valid = false
                values[f.key] = v
            }
            if (!valid) {
                Ui.toast(ctx, R.string.invalid_input)
                return@setOnClickListener
            }
            if (onOk(values)) dialog.dismiss()
        }
    }

    fun confirm(ctx: Context, title: CharSequence, body: CharSequence?, okRes: Int = R.string.ok, onOk: () -> Unit) {
        AlertDialog.Builder(ctx).setTitle(title).setMessage(body)
            .setPositiveButton(okRes) { _, _ -> onOk() }
            .setNegativeButton(R.string.cancel, null).show()
    }

    fun showText(ctx: Context, title: CharSequence, text: String, mono: Boolean = true) {
        val tv = TextView(ctx).apply {
            this.text = text
            setTextIsSelectable(true)
            if (mono) setTextAppearance(R.style.Mono) else setTextAppearance(R.style.Body)
            setPadding(Ui.dp(ctx, 12), Ui.dp(ctx, 12), Ui.dp(ctx, 12), Ui.dp(ctx, 12))
            if (mono) setBackgroundResource(R.drawable.bg_mono)
            textDirection = View.TEXT_DIRECTION_LTR
        }
        val wrap = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(Ui.dp(ctx, 20), Ui.dp(ctx, 8), Ui.dp(ctx, 20), 0)
            addView(tv)
        }
        val scroll = ScrollView(ctx).apply { addView(wrap) }
        AlertDialog.Builder(ctx).setTitle(title).setView(scroll)
            .setPositiveButton(R.string.close, null)
            .setNeutralButton(R.string.copy) { _, _ -> Ui.copy(ctx, text) }
            .setNegativeButton(R.string.share) { _, _ -> Ui.share(ctx, text, title.toString()) }
            .show()
    }

    fun choose(ctx: Context, title: CharSequence, items: List<CharSequence>, onPick: (Int) -> Unit) {
        AlertDialog.Builder(ctx).setTitle(title).setItems(items.toTypedArray()) { _, i -> onPick(i) }
            .setNegativeButton(R.string.cancel, null).show()
    }
}
