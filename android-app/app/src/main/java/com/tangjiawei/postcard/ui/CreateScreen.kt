package com.tangjiawei.postcard.ui

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.tangjiawei.postcard.CreationState
import com.tangjiawei.postcard.PostcardViewModel
import com.tangjiawei.postcard.util.ImageUtils

@Composable
fun CreateScreen(state: CreationState, viewModel: PostcardViewModel, modifier: Modifier = Modifier, onCommunity: () -> Unit) {
    val context = LocalContext.current
    var publishOpen by remember { mutableStateOf(false) }
    var skillMenu by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.selectImage(uri)
    }
    var pendingSave by remember { mutableStateOf<(() -> Unit)?>(null) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) pendingSave?.invoke() else Toast.makeText(context, "需要存储权限才能保存", Toast.LENGTH_SHORT).show()
        pendingSave = null
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Text("把一张照片，编辑成值得留下的片刻。", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            PhotoPicker(
                state = state,
                onPick = { picker.launch("image/*") },
                onClear = viewModel::clearImage,
            )
        }
        item {
            OutlinedTextField(
                value = state.description,
                onValueChange = viewModel::setDescription,
                label = { Text("照片描述（可选）") },
                placeholder = { Text("黄昏时分，海边的人安静地望着远方……") },
                minLines = 3,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Text("生成模式", fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 8.dp)) {
                FilterChip(
                    selected = state.mode == "fast",
                    onClick = { viewModel.setMode("fast") },
                    label = { Text("快速 · 768") },
                )
                FilterChip(
                    selected = state.mode == "quality",
                    onClick = { viewModel.setMode("quality") },
                    label = { Text("高质量 · 1024") },
                )
            }
        }
        item {
            Text("风格", fontWeight = FontWeight.SemiBold)
            Box(modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(onClick = { skillMenu = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(state.skills.find { it.id == state.skillId }?.name ?: "象牙抽象编辑", modifier = Modifier.weight(1f))
                    Icon(Icons.Outlined.ExpandMore, null)
                }
                DropdownMenu(expanded = skillMenu, onDismissRequest = { skillMenu = false }) {
                    state.skills.forEach { skill ->
                        DropdownMenuItem(
                            text = { Column { Text(skill.name); if (skill.desc.isNotBlank()) Text(skill.desc, style = MaterialTheme.typography.bodySmall) } },
                            onClick = { viewModel.setSkill(skill.id); skillMenu = false },
                        )
                    }
                }
            }
        }
        item {
            Button(
                onClick = viewModel::generate,
                enabled = state.uploadDataUrl != null && !state.preparing && !state.generating,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (state.generating) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Icon(Icons.Outlined.AddPhotoAlternate, null)
                Spacer(Modifier.width(10.dp))
                Text(if (state.generating) "生成中 · ${state.elapsedSeconds} 秒" else "生成明信片")
            }
            if (state.generating) {
                TextButton(onClick = viewModel::cancelGeneration, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Cancel, null)
                    Spacer(Modifier.width(6.dp))
                    Text("停止等待")
                }
            }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
            state.message?.let { Text(it, color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(top = 8.dp)) }
        }
        if (state.generatedImageValue != null) {
            item {
                HorizontalDivider()
                Text("生成结果", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 16.dp))
            }
            item { ResultPostcard(state) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    ActionButton(Icons.Outlined.Download, "保存", Modifier.weight(1f)) {
                        val action = { savePostcard(context, state) }
                        if (Build.VERSION.SDK_INT < 29 && ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                            pendingSave = action
                            permission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        } else action()
                    }
                    ActionButton(Icons.Outlined.ContentCopy, "复制", Modifier.weight(1f)) {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("明信片文案", state.sentence))
                        Toast.makeText(context, "文案已复制", Toast.LENGTH_SHORT).show()
                    }
                    ActionButton(Icons.Outlined.IosShare, "分享", Modifier.weight(1f)) { sharePostcard(context, state) }
                }
                Button(onClick = { publishOpen = true }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                    Icon(Icons.Outlined.Public, null)
                    Spacer(Modifier.width(8.dp))
                    Text("分享到社区")
                }
            }
        }
    }

    if (publishOpen) {
        PublishDialog(
            nickname = viewModel.preferences.nickname,
            onDismiss = { publishOpen = false },
            onPublish = { title, description ->
                viewModel.publish(title, description) { ok ->
                    if (ok) {
                        publishOpen = false
                        onCommunity()
                    }
                }
            },
        )
    }
}

@Composable
private fun PhotoPicker(state: CreationState, onPick: () -> Unit, onClear: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f).clickable(onClick = onPick),
        shape = RoundedCornerShape(6.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Box(contentAlignment = Alignment.Center) {
            when {
                state.preview != null -> Image(state.preview.asImageBitmap(), "照片预览", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                state.preparing -> CircularProgressIndicator()
                else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.AddPhotoAlternate, null, modifier = Modifier.size(42.dp))
                    Text("选择一张照片", modifier = Modifier.padding(top = 10.dp))
                }
            }
            if (state.preview != null) {
                IconButton(onClick = onClear, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).background(MaterialTheme.colorScheme.surface.copy(alpha = .86f), RoundedCornerShape(4.dp))) {
                    Icon(Icons.Outlined.Cancel, "移除照片")
                }
            }
        }
    }
}

@Composable
private fun ResultPostcard(state: CreationState) {
    Surface(shape = RoundedCornerShape(6.dp), tonalElevation = 2.dp) {
        Column {
            state.generatedBitmap?.let {
                Image(it.asImageBitmap(), "生成图片", Modifier.fillMaxWidth().aspectRatio(1f), contentScale = ContentScale.Crop)
            }
            Column(Modifier.padding(22.dp)) {
                Text("EDITORIAL", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(
                    state.sentence.ifBlank { "（无文案）" },
                    style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif),
                    modifier = Modifier.padding(top = 18.dp),
                )
                Text(ImageUtils.today(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 18.dp))
            }
        }
    }
}

@Composable
private fun ActionButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = modifier) {
        Icon(icon, label, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(5.dp))
        Text(label)
    }
}

@Composable
private fun PublishDialog(nickname: String, onDismiss: () -> Unit, onPublish: (String, String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("分享到社区") },
        text = {
            Column {
                Text("发布者：${nickname.ifBlank { "匿名用户" }}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(title, { title = it.take(60) }, label = { Text("标题（可选）") }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
                OutlinedTextField(description, { description = it.take(300) }, label = { Text("想说的话（可选）") }, minLines = 3, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
            }
        },
        confirmButton = { TextButton(onClick = { onPublish(title, description) }) { Text("发布") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}

private fun postcardBitmap(state: CreationState) = state.generatedBitmap?.let { ImageUtils.renderPostcard(it, state.sentence, ImageUtils.today()) }

private fun savePostcard(context: Context, state: CreationState) {
    runCatching { postcardBitmap(state)?.let { ImageUtils.saveToGallery(context, it) } ?: error("图片尚未加载完成") }
        .onSuccess { Toast.makeText(context, "已保存到相册", Toast.LENGTH_SHORT).show() }
        .onFailure { Toast.makeText(context, it.message ?: "保存失败", Toast.LENGTH_LONG).show() }
}

private fun sharePostcard(context: Context, state: CreationState) {
    runCatching {
        val bitmap = postcardBitmap(state) ?: error("图片尚未加载完成")
        val uri = ImageUtils.shareFile(context, bitmap)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, state.sentence)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "分享明信片"))
    }.onFailure { Toast.makeText(context, it.message ?: "分享失败", Toast.LENGTH_LONG).show() }
}
