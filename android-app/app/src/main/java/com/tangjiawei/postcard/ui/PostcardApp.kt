package com.tangjiawei.postcard.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.PeopleAlt
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tangjiawei.postcard.PostcardViewModel

@Composable
fun PostcardApp(viewModel: PostcardViewModel = viewModel()) {
    val creation by viewModel.creation.collectAsState()
    val community by viewModel.community.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    var settingsOpen by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            AppTopBar(
                title = if (tab == 0) "照片明信片" else "社区广场",
                onSettings = { settingsOpen = true },
                onRefresh = if (tab == 1) viewModel::refreshCommunity else null,
            )
        },
        bottomBar = {
            BottomAppBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Outlined.AddPhotoAlternate, null) },
                    label = { Text("创作") },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Outlined.PeopleAlt, null) },
                    label = { Text("社区") },
                )
            }
        },
    ) { padding ->
        if (tab == 0) {
            CreateScreen(creation, viewModel, Modifier.padding(padding), onCommunity = { tab = 1 })
        } else {
            CommunityScreen(community, viewModel, Modifier.padding(padding))
        }
    }

    if (settingsOpen) {
        SettingsDialog(
            initialBaseUrl = viewModel.preferences.baseUrl,
            initialNickname = viewModel.preferences.nickname,
            onDismiss = { settingsOpen = false },
            onSave = { url, nickname, callback -> viewModel.saveSettings(url, nickname, callback) },
        )
    }
}

@Composable
private fun SettingsDialog(
    initialBaseUrl: String,
    initialNickname: String,
    onDismiss: () -> Unit,
    onSave: (String, String, (Boolean, String) -> Unit) -> Unit,
) {
    var url by remember { mutableStateOf(initialBaseUrl) }
    var nickname by remember { mutableStateOf(initialNickname) }
    var checking by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("连接设置") },
        text = {
            Column {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("服务地址") },
                    placeholder = { Text("http://192.168.1.10:5123/") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = nickname,
                    onValueChange = { nickname = it.take(20) },
                    label = { Text("社区昵称") },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    singleLine = true,
                )
                result?.let {
                    Text(it, color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(top = 12.dp))
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !checking && url.startsWith("http"),
                onClick = {
                    checking = true
                    result = "正在检测连接…"
                    onSave(url, nickname) { ok, message ->
                        checking = false
                        result = message
                        if (ok) onDismiss()
                    }
                },
            ) { Text("保存并检测") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}
